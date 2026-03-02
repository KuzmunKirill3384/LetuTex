# LetuTEX

Веб-редактор LaTeX в стиле Overleaf. Полнофункциональный редактор с компиляцией, предпросмотром PDF, историей версий, шаблонами и системой совместного доступа.

## Архитектура

### Общая схема системы

```mermaid
flowchart LR
  Client["Vue 3 SPA<br/>(Ace Editor, Tailwind)"]
  API["Express API<br/>(Node.js)"]
  FS[("Файловое<br/>хранилище")]
  TeX["pdflatex / xelatex<br/>lualatex / latexmk"]
  Client -->|HTTP / REST| API
  API --> FS
  API --> TeX
```

### Слоистая архитектура (Clean Architecture)

```mermaid
flowchart TB
  subgraph Presentation["Presentation Layer"]
    Routes["routes/<br/>auth, projects, files,<br/>compile, history, download"]
  end
  
  subgraph Application["Application Layer"]
    Services["services/<br/>projectService, fileService,<br/>compileService, synctexService"]
  end
  
  subgraph Domain["Domain Layer"]
    Validation["domain/validation.js<br/>validatePath, parseLatexErrors"]
    Exceptions["exceptions.js<br/>NotFoundError, ForbiddenError"]
  end
  
  subgraph Infrastructure["Infrastructure Layer"]
    FileStore["fileStore.js"]
    ProjectRepo["projectRepository.js"]
    UserStore["userStore.js"]
    CompileRunner["compileRunner.js"]
  end
  
  Routes --> Services
  Services --> Validation
  Services --> Exceptions
  Services --> FileStore
  Services --> ProjectRepo
  Services --> UserStore
  Services --> CompileRunner
```

- **Presentation** — Express-маршруты (`server/routes/`)
- **Application** — сервисный слой (`server/services/`)
- **Domain** — валидация, сущности (`server/domain/`)
- **Infrastructure** — хранилище, компилятор (`server/infrastructure/`)

### Процесс компиляции LaTeX

```mermaid
sequenceDiagram
  autonumber
  participant U as Пользователь
  participant E as Editor (Vue)
  participant API as Express API
  participant CS as compileService
  participant CR as compileRunner
  participant TeX as pdflatex/latexmk
  
  U->>E: Ctrl+Enter (компиляция)
  E->>E: Автосохранение файла
  E->>API: POST /api/projects/:id/compile
  API->>CS: compile(projectId, userId)
  CS->>CS: Проверка доступа (requireWriteAccess)
  CS->>CS: Блокировка проекта (lock)
  CS->>CR: run(projectRoot, mainFile, compiler)
  
  alt latexmk доступен
    CR->>TeX: latexmk -pdf main.tex
  else fallback
    CR->>TeX: pdflatex main.tex
    CR->>TeX: bibtex (если есть .bib)
    CR->>TeX: pdflatex main.tex
  end
  
  TeX-->>CR: stdout/stderr + exit code
  CR->>CR: parseLatexErrors(log)
  CR-->>CS: {success, log, errors}
  CS->>CS: Разблокировка проекта
  CS-->>API: result
  API-->>E: {success, pdf_url, log, errors}
  
  alt success = true
    E->>E: Показать PDF превью
  else success = false
    E->>E: Показать ошибки в логе
  end
```

### Аутентификация и авторизация

```mermaid
sequenceDiagram
  autonumber
  participant U as Пользователь
  participant C as Client (Vue)
  participant API as Express API
  participant Auth as auth middleware
  participant US as userStore
  
  U->>C: Ввод логина/пароля
  C->>API: POST /api/auth/login
  API->>US: authenticate(username, password)
  US->>US: bcrypt.compare(password, hash)
  
  alt Успех
    US-->>API: {id, username, display_name}
    API->>API: Set-Cookie: user_id (signed)
    API-->>C: 200 {user}
    C->>C: Редирект на /editor
  else Ошибка
    US-->>API: null
    API-->>C: 401 {detail: "Invalid credentials"}
  end
  
  Note over C,API: Последующие запросы
  C->>API: GET /api/projects (Cookie: user_id)
  API->>Auth: getCurrentUser(req)
  Auth->>Auth: Проверка подписи cookie
  Auth->>US: getById(userId)
  US-->>Auth: user
  Auth->>Auth: req.user = user
  API-->>C: 200 {projects}
```

### Структура данных проекта

```mermaid
erDiagram
  USER ||--o{ PROJECT : owns
  USER ||--o{ COLLABORATOR : participates
  PROJECT ||--o{ COLLABORATOR : has
  PROJECT ||--o{ FILE : contains
  FILE ||--o{ VERSION : has_history
  
  USER {
    string id PK
    string username UK
    string password_hash
    string display_name
  }
  
  PROJECT {
    string id PK
    string name
    string owner_id FK
    string main_file
    string compiler
    datetime updated_at
  }
  
  COLLABORATOR {
    string project_id FK
    string user_id FK
    enum role "read | write"
  }
  
  FILE {
    string path PK
    string project_id FK
    blob content
  }
  
  VERSION {
    string id PK
    string file_path FK
    datetime timestamp
    blob content
  }
```

### Компоненты фронтенда

```mermaid
flowchart TB
  subgraph Views["Views (страницы)"]
    Landing["LandingView"]
    Login["LoginView"]
    Editor["EditorView"]
    Account["AccountView"]
  end
  
  subgraph Components["Components"]
    Header["AppHeader"]
    AceEd["AceEditor"]
    PDF["PdfPreviewSync"]
    Toolbar["LatexToolbar"]
    Modal["ModalDialog"]
    Card["ProjectCard"]
  end
  
  subgraph Composables["Composables (логика)"]
    useAuth["useAuth"]
    useEditor["useEditor"]
    useApi["useApi"]
    useToast["useToast"]
    latexComp["latexCompletions"]
  end
  
  Editor --> Header
  Editor --> AceEd
  Editor --> PDF
  Editor --> Toolbar
  Editor --> Modal
  
  Landing --> Card
  Landing --> Modal
  
  Editor --> useEditor
  Editor --> useAuth
  AceEd --> latexComp
  
  useEditor --> useApi
  useEditor --> useToast
  useAuth --> useApi
```

### Обработка файловых операций

```mermaid
flowchart TD
  subgraph Input["Входные данные"]
    Path["filePath от клиента"]
  end
  
  subgraph Validation["Валидация (domain/validation.js)"]
    V1["validatePathInsideProject<br/>• path.resolve() внутри root<br/>• запрет '..' и абсолютных путей"]
    V2["validateFileExtension<br/>• whitelist: .tex, .bib, .sty..."]
    V3["validateContentSize<br/>• MAX_FILE_SIZE_BYTES"]
  end
  
  subgraph Service["fileService"]
    S1["createFile / save / delete"]
  end
  
  subgraph Store["fileStore (infrastructure)"]
    FS["read / write / rename / delete"]
    History["saveHistory / listHistory"]
  end
  
  Path --> V1
  V1 -->|OK| V2
  V2 -->|OK| V3
  V3 -->|OK| S1
  S1 --> FS
  FS --> History
  
  V1 -->|403 Forbidden| Error["Ошибка"]
  V2 -->|400 Bad Request| Error
  V3 -->|400 Bad Request| Error
```

Подробнее: [docs/architecture.md](docs/architecture.md)

## Возможности

### Редактор
- Ace Editor с подсветкой синтаксиса LaTeX
- Расширенное автодополнение команд и окружений (триггер по `\`)
- Пользовательские сниппеты (LatexToolbar + localStorage)
- Folding по `\begin`/`\end` и секциям
- Навигация по структуре документа (outline)
- Переход к определению команды (Ctrl+Click)
- Автодополнение `\cite{}` по ключам из `.bib`

### Компиляция
- pdfLaTeX, XeLaTeX, LuaLaTeX — выбор в настройках проекта
- latexmk при наличии, fallback на прямой вызов компилятора
- Поддержка BibTeX/Biber (через latexmk или явный вызов)
- Опциональная компиляция в Docker-контейнере (`USE_DOCKER_COMPILE=true`)
- Лог с разбором ошибок, клик по ошибке → переход в редактор
- SyncTeX: клик в PDF → строка в редакторе

### Управление проектами
- CRUD проектов, клонирование
- Иерархия файлов и папок (дерево в сайдбаре)
- Загрузка файлов (drag-and-drop), загрузка ZIP
- Скачивание проекта как ZIP
- Главный файл (main_file), переименование, удаление
- История версий файлов с восстановлением

### Шаблоны
- 5 готовых шаблонов: статья, отчёт, ГОСТ-отчёт, Beamer, диссертация
- Создание проекта из шаблона

### Совместный доступ
- Владелец + соавторы (роли read / write)
- Приглашение по имени пользователя

### UI/UX
- Палитра ЛЭТИ, glass morphism, адаптивная вёрстка
- Toast-уведомления, модальные окна, контекстное меню
- Горячие клавиши (Ctrl+S, Ctrl+Enter, Quick Open)
- Авто-компиляция с debounce

## Требования

- **Node.js** 18+
- **TeX Live** (или MiKTeX) — команды `pdflatex`, `latexmk` в PATH
- Опционально: **Docker** для изолированной компиляции

## Установка и запуск

### Быстрый старт

```bash
git clone <repo-url> leti-latex-editor
cd leti-latex-editor
cp .env.example .env        # настроить при необходимости
npm install
npm run build               # сборка Vue → dist/
npm start                   # Express на порту 8000
```

Откройте http://localhost:8000. Демо-вход: логин `demo`, пароль `demo`.

### Режим разработки

```bash
# Терминал 1: Express API (порт 8000)
npm run dev

# Терминал 2: Vite dev server (порт 5173, proxy → 8000)
npm run dev:frontend
```

### Docker

```bash
docker compose up --build
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `8000` | Порт HTTP-сервера |
| `DATA_DIR` | `./data` | Каталог данных (проекты, пользователи) |
| `SECRET_KEY` | `change-me-in-production` | Секрет для подписи cookie |
| `COMPILE_TIMEOUT_SECONDS` | `60` | Таймаут компиляции (секунды) |
| `MAX_FILE_SIZE_BYTES` | `1048576` | Максимальный размер файла (байты) |
| `MAX_PROJECTS_PER_USER` | `50` | Лимит проектов на пользователя |
| `USE_DOCKER_COMPILE` | `false` | Компиляция в Docker-контейнере |
| `DOCKER_TEX_IMAGE` | `texlive/texlive:latest` | Docker-образ TeX Live |
| `ALLOWED_ORIGINS` | `*` | CORS origins (через запятую) |

Полный пример: [.env.example](.env.example)

## API

### Аутентификация

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |

### Проекты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects` | Список проектов |
| POST | `/api/projects` | Создать проект |
| GET | `/api/projects/:id` | Детали проекта (файлы, дерево) |
| PATCH | `/api/projects/:id` | Обновить (имя, main_file, compiler) |
| DELETE | `/api/projects/:id` | Удалить проект |
| POST | `/api/projects/:id/clone` | Клонировать |
| GET | `/api/projects/:id/collaborators` | Список соавторов |
| POST | `/api/projects/:id/collaborators` | Добавить соавтора |
| DELETE | `/api/projects/:id/collaborators/:uid` | Удалить соавтора |

### Файлы

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/projects/:id/files` | Создать файл |
| POST | `/api/projects/:id/folders` | Создать папку |
| POST | `/api/projects/:id/upload` | Загрузить файлы (multipart) |
| POST | `/api/projects/:id/upload-zip` | Загрузить и распаковать ZIP |
| GET | `/api/projects/:id/files/*` | Содержимое файла |
| PUT | `/api/projects/:id/files/*` | Сохранить файл |
| PATCH | `/api/projects/:id/files/*` | Переименовать |
| DELETE | `/api/projects/:id/files/*` | Удалить |

### Компиляция и скачивание

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/projects/:id/compile` | Компилировать |
| GET | `/api/projects/:id/output.pdf` | Скачать PDF |
| GET | `/api/projects/:id/download` | Скачать ZIP проекта |
| GET | `/api/projects/:id/synctex-inverse` | SyncTeX (PDF → source) |
| GET | `/api/projects/:id/definitions` | Определения команд |
| GET | `/api/projects/:id/bib-keys` | Ключи цитирования |

### История

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects/:id/files/*/history` | Версии файла |
| GET | `/api/projects/:id/files/*/history/:vid` | Содержимое версии |
| POST | `/api/projects/:id/files/*/restore` | Восстановить версию |

### Служебные

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/templates` | Список шаблонов |

## Структура проекта

```
leti-latex-editor/
├── server/                  # Backend (Express)
│   ├── index.js             # Точка входа
│   ├── config.js            # Конфигурация
│   ├── exceptions.js        # Ошибки приложения
│   ├── domain/
│   │   └── validation.js    # Валидация путей, расширений, парсинг ошибок
│   ├── infrastructure/
│   │   ├── compileRunner.js # Запуск pdflatex/latexmk/Docker
│   │   ├── fileStore.js     # Файловое хранилище
│   │   ├── projectRepository.js
│   │   └── userStore.js     # Хранилище пользователей
│   ├── middleware/
│   │   └── auth.js          # Аутентификация
│   ├── routes/              # REST-маршруты
│   │   ├── auth.js
│   │   ├── compile.js
│   │   ├── download.js
│   │   ├── files.js
│   │   ├── history.js
│   │   ├── projects.js
│   │   └── templates.js
│   └── services/            # Бизнес-логика
│       ├── bibKeysService.js
│       ├── compileService.js
│       ├── definitionsService.js
│       ├── fileService.js
│       ├── projectService.js
│       └── synctexService.js
├── src/                     # Frontend (Vue 3)
│   ├── main.js
│   ├── App.vue
│   ├── router/index.js
│   ├── assets/style.css     # Tailwind + кастомные стили
│   ├── components/
│   │   ├── AceEditor.vue
│   │   ├── AppHeader.vue
│   │   ├── LatexToolbar.vue
│   │   ├── ModalDialog.vue
│   │   ├── PdfPreviewSync.vue
│   │   └── ProjectCard.vue
│   ├── composables/
│   │   ├── latexCompletions.js
│   │   ├── useApi.js
│   │   ├── useAuth.js
│   │   ├── useCustomSnippets.js
│   │   ├── useEditor.js
│   │   └── useToast.js
│   └── views/
│       ├── AccountView.vue
│       ├── EditorView.vue
│       ├── LandingView.vue
│       ├── LoginView.vue
│       └── NotFoundView.vue
├── templates/               # LaTeX-шаблоны
│   ├── article/
│   ├── beamer/
│   ├── gost-report/
│   ├── report/
│   └── thesis/
├── tests/                   # Тесты (Vitest)
│   ├── server/
│   └── client/
├── docs/                    # Документация
│   ├── architecture.md
│   ├── deployment.md
│   ├── user-guide.md
│   └── plan-overleaf-competitor.md
├── .github/workflows/ci.yml # CI pipeline
├── Dockerfile
├── docker-compose.yml
├── package.json
├── vite.config.js
├── vitest.config.js
├── eslint.config.js
├── .prettierrc
├── .env.example
└── .gitignore
```

## Тестирование

```bash
npm test                # запуск всех тестов
npm run test:watch      # watch-режим
npm run test:coverage   # с покрытием
```

Тесты разделены на:
- **Backend unit** — валидация, сервисы (`tests/server/`)
- **Backend integration** — API-тесты через supertest (`tests/server/routes/`)
- **Frontend unit** — composables, компоненты (`tests/client/`)

## Верификация работоспособности

### Автоматическая проверка

```bash
npm ci            # установка зависимостей
npm run build     # сборка фронтенда
npm test          # запуск всех тестов (86 тестов)
npm run lint      # проверка ESLint
```

### Ручная проверка

1. **Запуск сервера**
   ```bash
   npm start
   ```

2. **Проверка health endpoint**
   ```bash
   curl http://localhost:8000/api/health
   # {"status":"ok","uptime":...,"timestamp":"..."}
   ```

3. **Авторизация** — откройте http://localhost:8000, войдите с логином `demo` и паролем `demo`

4. **Создание проекта** — нажмите «Новый проект» или используйте шаблон

5. **Редактирование** — откройте `main.tex`, внесите изменения

6. **Компиляция** — нажмите Ctrl+Enter или кнопку «Компилировать»
   - При наличии TeX Live появится PDF-превью
   - При отсутствии TeX — структурированная ошибка в логе

7. **Скачивание проекта** — нажмите «Скачать ZIP»

## Линтинг и форматирование

```bash
npm run lint            # проверка ESLint
npm run lint:fix        # автоисправление
npm run format          # форматирование Prettier
```

## Развёртывание

Подробная инструкция: [docs/deployment.md](docs/deployment.md)

Краткие шаги для production:
1. Установить Node.js 18+ и TeX Live
2. Клонировать репозиторий, `npm install`, `npm run build`
3. Настроить `.env` (обязательно сменить `SECRET_KEY`)
4. Запустить через systemd или Docker
5. Настроить Nginx reverse proxy + SSL

## Документация

- [Архитектура](docs/architecture.md)
- [Развёртывание](docs/deployment.md)
- [Руководство пользователя](docs/user-guide.md)
- [План развития](docs/plan-overleaf-competitor.md)

## О проекте

Проект разработан в рамках производственной практики в СПбГЭТУ «ЛЭТИ».

## Лицензия

Распространяется под лицензией [MIT](LICENSE).
