# Backend for Xmas Hack 2024

## Сборка и запуск

1. В папку data закидываем файлы, которые хотим протестировать
2. Создаем .env, прописываем там следующие переменные:

```
POSTGRES_USER=XMAS2024
POSTGRES_PASSWORD=XMASPASSWORD
POSTGRES_DB=pipeline
POSTGRES_HOST=db
POSTGRES_PORT=5432

PAYMENTS_FILE=./data/payments_1.csv
PROVIDERS_FILE=./data/providers_1.csv
EXRATES_FILE=./data/ex_rates.csv
```

3. Запускаем docker compose

```
docker compose up
```
