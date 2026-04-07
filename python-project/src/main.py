import os
import streamlit as st
import json
from openai import OpenAI
from ddgs import DDGS
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs
import yt_dlp
import whisper
import tempfile
import validators


def get_video_id(url):
    try:
        parsed_url = urlparse(url)
        host = (parsed_url.netloc or "").lower()

        if "youtu.be" in host:
            video_id = parsed_url.path.strip("/").split("/")[0]
            return video_id or None

        if "youtube.com" in host:
            if parsed_url.path == "/watch":
                query = parse_qs(parsed_url.query)
                return query.get("v", [None])[0]

            if parsed_url.path.startswith("/shorts/"):
                video_id = parsed_url.path.split("/shorts/")[-1].split("/")[0]
                return video_id or None

            if parsed_url.path.startswith("/embed/"):
                video_id = parsed_url.path.split("/embed/")[-1].split("/")[0]
                return video_id or None

        return None
    except Exception:
        return None


def download_youtube_audio(url):
    temp_dir = tempfile.mkdtemp(prefix="veritas_audio_")
    output_template = os.path.join(temp_dir, "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "m4a/bestaudio/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "ios", "tv", "web"],
                "player_skip": ["webpage", "configs", "js"]
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
    }
    
    # If a cookies.txt file is provided in the root directory, use it to bypass the bot check
    if os.path.exists("cookies.txt"):
        ydl_opts["cookiefile"] = "cookies.txt"

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        requested_downloads = info.get("requested_downloads") or []
        if requested_downloads and requested_downloads[0].get("filepath"):
            return requested_downloads[0]["filepath"]
        return ydl.prepare_filename(info)


@st.cache_resource
def load_whisper_model():
    return whisper.load_model("base")


def whisper_transcribe(audio_path):
    model = load_whisper_model()
    result = model.transcribe(audio_path)
    return (result.get("text") or "").strip()


def get_youtube_transcript(url):
    video_id = get_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL. Could not extract video ID.")

    try:
        transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
        transcript_text = " ".join(item.get("text", "") for item in transcript_data).strip()
        if transcript_text:
            return transcript_text
    except Exception:
        pass

    try:
        audio_path = download_youtube_audio(url)
    except Exception as e:
        raise RuntimeError(f"No transcript available and audio download failed: {e}") from e

    try:
        transcription = whisper_transcribe(audio_path)
        if not transcription:
            raise RuntimeError("Whisper returned empty transcription.")
        return transcription
    except Exception as e:
        raise RuntimeError(f"No transcript available and Whisper transcription failed: {e}") from e


def format_search_results(search_results):
    formatted_search_context = ""
    for i, res in enumerate(search_results):
        title = res.get("title")
        link = res.get("href")
        snippet = res.get("body")
        formatted_search_context += f"Source {i + 1} Title: {title}\n"
        formatted_search_context += f"Source {i + 1} Link: {link}\n"
        formatted_search_context += f"Source {i + 1} Snippet: {snippet}\n\n"
    return formatted_search_context


def run_search(search_query):
    search_results = []
    with DDGS() as ddgs:
        for result in ddgs.text(search_query, max_results=8):
            search_results.append(result)
    return search_results


def build_prompt(analysis_text, formatted_search_context, has_search_results):
    return f'''
You are a highly capable live fact-checking system.

Your task:
1) Extract the key factual claims from the provided content.
2) Compare each claim against the LIVE web search evidence.
3) Detect misinformation, inconsistencies, or unsupported claims.
4) Detect emotional/political framing and bias patterns.
5) Assign a final veracity score.

IMPORTANT:
- Prioritize the provided LIVE web search context.
- If evidence is mixed, explain uncertainty.
- Output STRICT JSON only. No extra text.

You must respond with exactly this JSON schema:
{{
  "score": number,
  "verdict": string,
  "reasoning": string,
  "redFlags": array,
  "bias": string,
  "confidence": number
}}

Content to analyze:
"{analysis_text}"

Web Search Results Context (LIVE DATA):
{formatted_search_context if has_search_results else "No relevant search results found."}
'''

def main():
    st.set_page_config(page_title="Veritas AI - Fake News Detector", page_icon="🛡️", layout="wide")

    st.title("🛡️ Veritas AI")
    st.caption("FAKE NEWS DETECTOR")

    with st.expander("⚙️ API Configuration", expanded=True):
        # Allow the user to specify their cloud/local URL and API key
        base_url = st.text_input("API Base URL", "https://api.groq.com/openai/v1")
        api_key_input = st.text_input("API Key", type="password", help="Enter your cloud API key here")
        model_name = st.text_input("Model Name (e.g., qwen2.5:32b, llama3.1)", "openai/gpt-oss-120b")

    st.markdown("""
    ### Analyze News Content
    Provide either text news content or a YouTube URL. The app will verify claims using live web search evidence and AI reasoning.
    """)

    text_content = st.text_area("📰 Text News Input", height=200, placeholder="Paste article text or a claim here...")
    youtube_url = st.text_input("📺 YouTube Video Input", placeholder="https://www.youtube.com/watch?v=...")

    if st.button("Detect Veracity", type="primary"):
        if not text_content.strip() and not youtube_url.strip():
            st.warning("Please enter text content or a YouTube URL to analyze.")
        else:
            with st.spinner("Searching the web and analyzing..."):
                client = OpenAI(
                    base_url=base_url,
                    # Fallback to "ollama" if no key is provided (for local passing)
                    api_key=api_key_input if api_key_input else "ollama"
                )

                analysis_text = ""
                source_mode = "text"

                if youtube_url.strip():
                    source_mode = "youtube"
                    if not validators.url(youtube_url):
                        st.error("Invalid URL format. Please provide a valid YouTube link.")
                        return

                    if not get_video_id(youtube_url):
                        st.error("Invalid YouTube URL. Supported formats include youtube.com/watch?v=... and youtu.be/...")
                        return

                    try:
                        with st.status("📺 Extracting YouTube transcript..."):
                            analysis_text = get_youtube_transcript(youtube_url)
                    except Exception as e:
                        st.error(f"Failed to process YouTube video: {e}")
                        return
                else:
                    analysis_text = text_content

                analysis_text = (analysis_text or "").strip()[:8000]
                if not analysis_text:
                    if source_mode == "youtube":
                        st.error("No transcript available for this YouTube video.")
                    else:
                        st.error("No valid text content to analyze.")
                    return
                
                # Use DuckDuckGo to search for context
                # Extract first 150 characters to form a query, or you can prompt the LLM to generate a search query!
                search_query = analysis_text[:150].replace('\n', ' ')
                
                with st.status(f"🔍 Searching the web for: '{search_query}...'"):
                    search_results = []
                    try:
                        search_results = run_search(search_query)
                        st.write(f"Found {len(search_results)} relevant articles.")
                    except Exception as e:
                        st.error(f"Search failed: {e}")
                
                # Format search results
                formatted_search_context = format_search_results(search_results)

                prompt = build_prompt(
                    analysis_text=analysis_text,
                    formatted_search_context=formatted_search_context,
                    has_search_results=bool(search_results),
                )
                
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": "You are an expert fact-checking AI. Always output valid JSON only."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"}
                    )
                    
                    result_text = response.choices[0].message.content
                    try:
                        result = json.loads(result_text)
                    except json.JSONDecodeError as e:
                        st.error(f"JSON parsing failure: {e}")
                        return
                    
                    st.success("Analysis Complete!")
                    
                    col1, col2 = st.columns([1, 2])
                    with col1:
                        st.metric("Veracity Score", f"{result['score']} / 100")
                        st.write(f"**Verdict:** {result['verdict']}")
                        st.write(f"**Confidence:** {result.get('confidence', 0) * 100:.1f}%")
                        st.write(f"**Bias Analysis:** {result['bias']}")
                    with col2:
                        st.subheader("Reasoning")
                        st.markdown(result['reasoning'])
                        
                        if result.get("redFlags"):
                            st.subheader("Red Flags 🚩")
                            for flag in result["redFlags"]:
                                st.write(f"- {flag}")
                        else:
                            st.write("No major red flags detected.")
                                
                    if search_results:
                        st.subheader("Verified Sources")
                        for res in search_results:
                            st.write(f"- [{res.get('title')}]({res.get('href')})")
                    else:
                        st.subheader("Verified Sources")
                        st.write("No sources available due to search failure or no matches.")
                                    
                except Exception as e:
                    st.error(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
