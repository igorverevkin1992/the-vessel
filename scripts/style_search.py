import os
import google.generativeai as genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv

load_dotenv()

CHROMA_PATH = "chroma_db"
API_KEY = os.getenv("GOOGLE_API_KEY")

genai.configure(api_key=API_KEY)

def get_style_examples(query_topic, k=3):
    """
    Searches ChromaDB for the 3 most similar transcript excerpts
    matching the given topic (query_topic).
    """
    embedding_model = "models/text-embedding-004"

    for model in genai.list_models():
        if 'embedContent' in model.supported_generation_methods:
            embedding_model = model.name
            break

    embeddings = GoogleGenerativeAIEmbeddings(model=embedding_model)

    try:
        db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        results = db.similarity_search(query_topic, k=k)
        context_text = "\n\n".join([f"--- STYLE EXAMPLE {i+1} ---\n{doc.page_content}" for i, doc in enumerate(results)])
        return context_text
    except Exception as e:
        print(f"Database search error: {e}")
        return ""

if __name__ == "__main__":
    test_topic = "The Matrix as documentary"
    print(f"Test search for topic: {test_topic}")
    print(get_style_examples(test_topic))
