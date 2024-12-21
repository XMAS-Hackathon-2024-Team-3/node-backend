# Backend for Xmas Hack 2024

## Сборка и запуск

1. В папку data закидываем файлы, которые хотим протестировать
2. Создаем .env, прописываем там следующие переменные:

```
POSTGRES_USER=user
POSTGRES_PASSWORD=ddd309kad
POSTGRES_DB=pipeline
POSTGRES_HOST=0.0.0.0
POSTGRES_PORT=5432
```

3. Запускаем docker compose

```
docker compose up
```
