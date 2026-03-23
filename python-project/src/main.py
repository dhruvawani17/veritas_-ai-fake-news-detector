import os
import streamlit as st
import json
from openai import OpenAI
from ddgs import DDGS
import time

def main():
    st.set_page_config(page_title="Veritas AI - Fake News Detector", page_icon="🛡️", layout="wide")

    st.title("🛡️ Veritas AI")
    st.caption("FAKE NEWS DETECTOR")

    with st.expander("⚙️ API Configuration", expanded=True):
        # Allow the user to specify their cloud/local URL and API key
        base_url = st.text_input("API Base URL", "http://localhost:11434/v1")
        api_key_input = st.text_input("API Key", type="password", help="Enter your cloud API key here")
        model_name = st.text_input("Model Name (e.g., qwen2.5:32b, llama3.1)", "qwen2.5:32b")

    st.markdown("""
    ### Analyze News Content
    Paste a news article, headline, or claim below. Our AI will analyze logical fallacies, source credibility, and bias patterns.
    """)

    content = st.text_area("Paste article text or a claim here...", height=200)

    if st.button("Detect Veracity", type="primary"):
        if not content.strip():
            st.warning("Please enter some text to analyze.")
        else:
            with st.spinner("Searching the web and analyzing..."):
                client = OpenAI(
                    base_url=base_url,
                    # Fallback to "ollama" if no key is provided (for local passing)
                    api_key=api_key_input if api_key_input else "ollama"
                )
                
                # Use DuckDuckGo to search for context
                # Extract first 150 characters to form a query, or you can prompt the LLM to generate a search query!
                search_query = content[:150].replace('\n', ' ')
                
                with st.status(f"🔍 Searching the web for: '{search_query}...'"):
                    search_results = []
                    try:
                        with DDGS() as ddgs:
                            for result in ddgs.text(search_query, max_results=8):
                                search_results.append(result)
                        st.write(f"Found {len(search_results)} relevant articles.")
                    except Exception as e:
                        st.warning(f"Could not fetch web search results: {e}")
                
                # Format search results
                formatted_search_context = ""
                for i, res in enumerate(search_results):
                    formatted_search_context += f"Source {i+1} Title: {res.get('title')}\n"
                    formatted_search_context += f"Source {i+1} Link: {res.get('href')}\n"
                    formatted_search_context += f"Source {i+1} Snippet: {res.get('body')}\n\n"

                prompt = f'''
                You are a highly capable live fact-checking system.
                
                Your job is to read the Provided News Content and compare it against the LIVE Web Search Results below.
                IMPORTANT: Your internal knowledge might be out of date. You MUST rely on the "Web Search Results Context" to determine if the news is currently happening or true right now. If the live search results confirm the news, you MUST mark it as True, even if you think it's impossible.

                Provide a detailed breakdown including a score (0-100, where 100 is completely factual), 
                a verdict, specific red flags found, and an analysis of political or emotional bias.
                
                You must respond in valid JSON format with exactly these fields:
                - "score" (number 0-100)
                - "verdict" (string: exactly one of "True", "Mostly True", "Mixed", "Mostly Fake", "Fake")
                - "reasoning" (string: Detailed markdown reasoning, cite the provided sources if you use them)
                - "redFlags" (array of strings: List of specific red flags or logical fallacies)
                - "bias" (string: Analysis of bias)
                - "confidence" (number 0.0 to 1.0)

                Content to analyze:
                "{content}"
                
                Web Search Results Context (LIVE DATA FROM TODAY):
                {formatted_search_context if search_results else "No relevant search results found."}
                '''
                
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
                    result = json.loads(result_text)
                    
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
                                
                    if search_results:
                        st.subheader("Verified Sources (DuckDuckGo Search)")
                        for res in search_results:
                            st.write(f"- [{res.get('title')}]({res.get('href')})")
                                    
                except Exception as e:
                    st.error(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
