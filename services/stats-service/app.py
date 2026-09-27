from fastapi import FastAPI

app = FastAPI(
    title="Stats Service",
    description="Statistics API for LifeBalance",
    version="0.1.0",
)


def calculate_net_calories(calories_in, calories_out):
    if calories_in < 0 or calories_out < 0:
        raise ValueError("Calories cannot be negative")

    return calories_in - calories_out


@app.get("/")
def root():
    return {
        "service": "stats-service",
        "status": "ok",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/stats")
def get_stats():
    return {
        "calories_in": 0,
        "calories_out": 0,
        "net_calories": 0,
    }
