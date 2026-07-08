import logging
from sqlalchemy.orm import Session
from app import models
from app.utils.security import hash_password

logger = logging.getLogger(__name__)


def seed_database(db: Session):
    """Seed demo users if they don't exist."""
    existing = db.query(models.User).first()
    if existing:
        return  # Already seeded

    demo_users = [
        {
            "full_name": "Dr. Vijay",
            "username": "faculty1",
            "password": "faculty123",
            "role": models.RoleEnum.faculty,
        },
        {
            "full_name": "Mr. Sethu",
            "username": "faculty2",
            "password": "faculty123",
            "role": models.RoleEnum.faculty,
        },
        {
            "full_name": "Hari",
            "username": "student1",
            "password": "student123",
            "role": models.RoleEnum.student,
        },
        {
            "full_name": "Thiru",
            "username": "student2",
            "password": "student123",
            "role": models.RoleEnum.student,
        },
        {
            "full_name": "Meervin",
            "username": "student3",
            "password": "student123",
            "role": models.RoleEnum.student,
        },
    ]

    for u in demo_users:
        user = models.User(
            full_name=u["full_name"],
            username=u["username"],
            password_hash=hash_password(u["password"]),
            role=u["role"],
        )
        db.add(user)

    db.commit()
    logger.info("Demo users seeded successfully.")