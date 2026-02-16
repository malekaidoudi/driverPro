from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes, stops, optimization, services
from app.api import favorite_stops, recurring_stops, delivery_attempts, ocr
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="DriverPro API",
    description="API for route optimization and delivery management",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.include_router(stops.router)
app.include_router(optimization.router)
app.include_router(services.router)
app.include_router(favorite_stops.router)
app.include_router(recurring_stops.router)
app.include_router(delivery_attempts.router)
app.include_router(ocr.router)


@app.get("/")
async def root():
    return {
        "message": "DriverPro API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
