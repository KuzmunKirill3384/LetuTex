# Автосинхронизация документации с GitHub Wiki

При пуше в `main` с изменёнными файлами в `docs/` или `README.md` workflow `.github/workflows/sync-wiki.yml` клонирует вики репозитория, копирует туда содержимое `docs/` и `README.md` (как главную страницу) и пушит изменения.

## Что нужно сделать один раз

1. **Включить Wiki** в репозитории: *Settings → General → Features → Wiki* (галочка Wiki).
2. **Создать вики одной страницей** (иначе репозиторий вики ещё не существует и workflow падает с "Repository not found"): перейти во вкладку **Wiki** репозитория → *Create the first page* → создать страницу (например, «Home» с текстом «Initial») → *Save*. После этого можно пушить — workflow подхватит и заполнит вики из `docs/`.
3. **Создать Personal Access Token (PAT):**
   - GitHub → *Settings → Developer settings → Personal access tokens → Tokens (classic)*.
   - Generate new token, включить scope **repo**.
   - Скопировать токен.
4. **Добавить секрет в репозиторий:**
   - В репо: *Settings → Secrets and variables → Actions*.
   - New repository secret: имя **`WIKI_TOKEN`**, значение — вставленный PAT.

После этого при каждом релевантном пуше в `main` вики будет обновляться автоматически. Если секрет `WIKI_TOKEN` не задан, workflow просто пропускает шаг.

## Что куда попадает

- **Home** в вики = содержимое корневого `README.md`.
- Остальные страницы вики = файлы из `docs/*.md` (например, `architecture.md`, `deployment.md`, `user-guide.md`).

Имена файлов в `docs/` становятся названиями страниц вики.

