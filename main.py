import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scripts.style_search import get_style_examples

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TopicRequest(BaseModel):
    topic: str

@app.get("/")
def read_root():
    return {"status": "THE VESSEL Backend is running"}

@app.post("/api/get-vessel-style")
async def get_style(request: TopicRequest):
    """
    Accepts a topic, searches ChromaDB for matching style examples
    from video essay transcripts and returns them to the frontend.
    """
    print(f"Incoming style request for topic: {request.topic}")
    try:
        style_context = get_style_examples(request.topic)
        return {
            "topic": request.topic,
            "style_context": style_context
        }
    except Exception as e:
        print(f"Server error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
