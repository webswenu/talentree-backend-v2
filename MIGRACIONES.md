# Migraciones de base de datos

## Por qué existe este documento

Hasta agosto de 2026 el esquema no se manejaba con migraciones. Lo armaba TypeORM
solo en cada arranque, comparando la base contra las entidades
(`DB_SYNCHRONIZE=true`, que además era el **default** en `docker-compose.yml`:
bastaba con que el `.env` no lo mencionara para que producción corriera así).

Eso tiene dos problemas serios:

1. **Cambios de esquema que nadie pidió ni aprobó.** Renombrar una propiedad de
   una entidad borra la columna vieja, con los datos dentro.

2. **Las migraciones no cuajaban.** Caso real: `AddOnDeleteSetNullToWorkerUser`
   dejaba el borrado de `workers.user_id` en `SET NULL`, y el siguiente arranque
   lo devolvía a `CASCADE` porque así lo decía la entidad. La migración se
   revertía sola y nadie se enteraba.

Hoy `synchronize` está apagado en producción por código —no solo por variable de
entorno— y el esquema se cambia con migraciones.

## La primera vez sobre una base existente: baseline

Una base construida con `synchronize` **no tiene tabla `migrations`**. Si se
corre `migration:run` tal cual, TypeORM no encuentra registro de nada e intenta
aplicar todas las migraciones desde cero contra un esquema que ya tiene sus
efectos: la primera que se topa con `CREATE TABLE "fixed_tests"` o
`ALTER TABLE "reports" ADD "status"` falla, porque eso ya está ahí.

`migration:baseline` resuelve esto. Para cada migración anterior le hace una
pregunta concreta a la base —¿existe la tabla?, ¿existe la columna?— y solo si
la respuesta es que sí la anota como aplicada, **sin ejecutarla**. Las que no
dejaron rastro quedan pendientes y las aplica `migration:run` normalmente.

```bash
# 1. La aplicación DEBE estar detenida.
#    Si sigue corriendo con synchronize encendido puede cambiar el esquema
#    mientras el baseline lo está midiendo, y entonces mide cualquier cosa.
npm run migration:baseline
npm run migration:run
npm run migration:show     # las 8 deben aparecer con [X]
```

Los dos comandos se pueden repetir sin daño: lo ya registrado se deja quieto.

Esto se hace **una sola vez por base**. Después, el ciclo normal es solo
`migration:run`.

## Deploy del backend

```bash
cd /home/ubuntu/talentree-backend-v2 && git pull origin main

# Construir primero: el contenedor viejo sigue sirviendo mientras tanto.
sudo docker-compose build backend

# La primera vez, y solo la primera:
sudo docker-compose run --rm backend npm run migration:baseline

sudo docker-compose run --rm backend npm run migration:run

# Recién ahora se toca el contenedor en pie. Separar el build del swap baja el
# corte de ~4 min a ~3 s: el docker-compose 1.29.2 de la instancia falla al
# recrear contenedores y borra el viejo antes de fallar.
sudo docker-compose stop backend && sudo docker-compose rm -f backend
sudo docker-compose up -d --no-build backend
```

Las migraciones van **antes** del swap a propósito: si una falla, el contenedor
viejo sigue arriba y no hay corte. Al revés, quedaría la aplicación nueva
hablándole a un esquema viejo.

## Crear una migración nueva

```bash
npm run migration:generate -- src/database/migrations/DescripcionDelCambio
```

Compara las entidades contra la base y escribe la diferencia. **Hay que leer lo
que genera antes de commitear**: si propone borrar algo que no esperabas, el
problema está en las entidades, no en la migración.

Un `migration:generate` sobre una base al día debe responder
`No changes in database schema were found`. Si responde otra cosa, entidades y
esquema no dicen lo mismo, y eso es deriva que hay que resolver — no un archivo
que haya que commitear.

## Reglas

- **`synchronize` jamás en producción.** Está forzado a `false` en
  `database.config.ts` cuando `NODE_ENV=production`, sin importar la variable de
  entorno.
- **Lo que declara la entidad y lo que hace la migración tienen que coincidir.**
  Si discrepan, el próximo `migration:generate` propone deshacer el cambio.
- **Las migraciones de datos, idempotentes.** `WHERE ... IS NULL`,
  `IF NOT EXISTS`, `CREATE OR REPLACE`. Una que solo se puede correr una vez es
  una que no se puede reintentar tras un fallo a medias.
- **Respaldo antes de migrar en producción.** `pg_dump --format=custom`.
