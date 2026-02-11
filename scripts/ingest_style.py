import os
import sys
from dotenv import load_dotenv
from langchain_community.document_loaders import Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
import google.generativeai as genai

# 1. Setup
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

SOURCE_FILE = "training_data/all_transcripts.docx"
CHROMA_PATH = "chroma_db"

if not api_key:
    raise ValueError("Error: GOOGLE_API_KEY not found in .env file")

def get_available_embedding_model():
    """Automatically finds an available embedding model"""
    print("Searching for available embedding models in your Google account...")
    try:
        genai.configure(api_key=api_key)
        for model in genai.list_models():
            if 'embedContent' in model.supported_generation_methods:
                print(f"   Found model: {model.name}")
                return model.name
    except Exception as e:
        print(f"Error searching for models: {e}")
        return "models/embedding-001"

    return None

def ingest_one_big_file():
    # 2. Select model
    model_name = get_available_embedding_model()
    if not model_name:
        print("No embedding model found! Check your API key.")
        return

    print(f"Starting to process file: {SOURCE_FILE} with model {model_name}")

    if not os.path.exists(SOURCE_FILE):
        print(f"File not found! Place transcripts in {SOURCE_FILE}")
        return

    # 3. Load
    try:
        loader = Docx2txtLoader(SOURCE_FILE)
        document = loader.load()
        if not document:
             print("File is empty.")
             return
        print(f"File loaded. Length: {len(document[0].page_content)} characters")
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # 4. Split
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=500,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = text_splitter.split_documents(document)
    print(f"File split into {len(chunks)} fragments.")

    # 5. Vectorize and save
    print("Creating knowledge base...")
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model=model_name)
        Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=CHROMA_PATH
        )
        print(f"SUCCESS! Style saved to '{CHROMA_PATH}'")
    except Exception as e:
        print(f"Error creating database: {e}")

if __name__ == "__main__":
    ingest_one_big_file()
