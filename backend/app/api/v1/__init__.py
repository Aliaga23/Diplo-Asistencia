from fastapi import APIRouter

from app.api.v1 import attendance, auth, courses, dashboard, imports, students

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(students.router)
api_router.include_router(attendance.router)
api_router.include_router(imports.router)
api_router.include_router(dashboard.router)
