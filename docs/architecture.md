# Архитектура LaTeX Editor ЛЭТИ

## Слоистая архитектура

Приложение разделено на четыре слоя:

- **Presentation (API)** — Express-маршруты в `server/`: приём запросов, вызов сервисов, формирование ответов. Бизнес-логика и прямой доступ к диску отсутствуют.
- **Application (Services)** — `server/services/`: оркестрация операций (создание/удаление проекта, сохранение файла с историей, компиляция с очередью). Используют репозитории и доменные модели.
- **Domain** — `server/domain/`: сущности (Project, FileInfo, CompileResult, User) и правила (валидация путей, лимиты, допустимые расширения).
- **Infrastructure** — `server/infrastructure/`: реализация хранения (ProjectRepository, FileStore, UserStore) и внешних вызовов (CompileRunner — subprocess pdflatex).

## Поток данных

- Запрос → Router → Service → Repository/Store → Файловая система (или в будущем БД).
- Ответ компиляции: CompileRunner возвращает CompileResult (success, log, errors); API подставляет pdf_url с project_id.

## Выбор технологий

- **Node.js 18+, Express** — единый стек с фронтендом, простое развёртывание, распространённость.
- **Файловое хранилище** — простота развёртывания и резервного копирования; при необходимости слой репозиториев позволяет перейти на БД или S3.
- **Tailwind CSS, Ace Editor** — быстрая вёрстка и редактирование кода с подсветкой LaTeX без тяжёлой сборки.

## Опциональная миграция на БД (фаза 2+)

Текущее хранение метаданных проектов и пользователей — файловое (`data/projects/<id>/meta.txt`, `owner.txt`, `collaborators.json`, `data/users.json`). Для масштабирования и централизованных прав доступа предусмотрена **опциональная** миграция:

- **Метаданные проектов**: таблицы `projects` (id, name, owner_id, main_file, compiler, updated_at), `project_collaborators` (project_id, user_id, role). Файлы проектов (содержимое .tex и т.д.) могут оставаться на диске или переехать в object storage.
- **Пользователи**: таблица `users` (id, username, password_hash, display_name) с заменой `userStore.js` на репозиторий, работающий с SQLite или PostgreSQL.
- **Реализация**: при `USE_DATABASE=true` (или аналоге) подключать слой репозиториев, читающий/пишущий в БД; иначе — текущее файловое хранилище. Миграции схемы — через инструменты выбранной БД (например, node-pg-migrate для PostgreSQL).
