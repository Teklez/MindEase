.PHONY: dev up down logs migrate makemigrations shell-backend seed seed-reset

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend alembic upgrade head

makemigrations:
	@if [ -z "$(m)" ]; then echo "Usage: make makemigrations m=\"description of change\""; exit 1; fi
	docker compose exec backend alembic revision --autogenerate -m "$(m)"

shell-backend:
	docker compose exec backend bash

seed:
	docker compose exec backend python -m app.seeds.seed_all

seed-reset:
	docker compose exec backend python -m app.seeds.seed_all --reset
