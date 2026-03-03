# Структура проекта LetuTEX

```
LetuTEX/
├── server/                 # Backend (Node.js)
│   ├── index.js, app.js    # Точка входа и Express-приложение
│   ├── config.js           # Конфигурация
│   ├── routes/             # API-маршруты
│   ├── services/           # Бизнес-логика (компиляция, проекты)
│   ├── middleware/         # Auth, ошибки
│   ├── domain/             # Доменные сущности
│   ├── infrastructure/     # Mongo, Redis, CLSI, file store
│   ├── documentUpdater/    # Микросервис обновления документа
│   ├── realTime/           # WebSocket / real-time
│   ├── clsi/               # LaTeX-компиляция (CLSI)
│   ├── fileStore/          # Хранение файлов
│   └── gitBridge/          # Git-интеграция
├── src/                    # Frontend (Vue 3 + Vite)
│   ├── main.js, App.vue
│   ├── components/
│   ├── views/
│   ├── composables/
│   ├── router/
│   └── assets/
├── templates/              # EJS-шаблоны (рендер страниц)
├── tests/                  # Тесты
├── scripts/                # Утилиты (backup-data.sh, init-mongo.js)
├── docs/                   # Документация (архитектура, деплой, гайды)
├── deploy/                 # Конфиги развёртывания
│   ├── nginx/              # Конфиг Nginx
│   ├── systemd/            # Unit systemd
│   └── k8s/                # Kubernetes (base манифесты)
├── package.json, vite.config.js
├── Dockerfile, docker-compose.yml
├── .env.example, .gitignore
├── README.md, report.md
└── STRUCTURE.md            # Этот файл
```

- **Запуск:** `npm run dev` (dev), `node server/index.js` (prod), Docker — см. README и docs/deployment.md.
- **K8s:** `kubectl apply -f deploy/k8s/base/` — см. deploy/k8s/README.md.
