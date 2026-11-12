#!/usr/bin/env bash
#
# Humo del registro publico de trabajador — hallazgos R-01 a R-06.
#
# Comprueba el contrato CONTRA UNA API DE VERDAD: codigo de estado y, sobre
# todo, el TEXTO del mensaje, que es donde estaba la mitad del problema.
# La capa de jest (register-worker.dto.spec.ts) prueba la misma tabla sin red;
# esta prueba que lo que esta desplegado se comporta igual.
#
# NINGUNA de estas peticiones puede crear un usuario: todas llevan una
# contrasena deliberadamente invalida, asi que la validacion falla antes de
# llegar al servicio. Por eso se puede correr contra produccion sin ensuciar.
#
# Uso:
#   ./scripts/humo-registro.sh                        # contra localhost
#   ./scripts/humo-registro.sh https://api.talentree.cl
#
set -uo pipefail

API="${1:-http://localhost:3100}"
URL="$API/api/v1/auth/register/worker"

# Contrasena invalida a proposito: es el seguro que impide crear nada.
PASS_INVALIDA='x'
RUT_VALIDO='15678234-3'

ok=0
fallo=0

# pedir <descripcion> <json-extra> <ausente|presente> <texto>
#
# Comprueba si el mensaje <texto> aparece o no en la respuesta. "ausente"
# significa que ese campo YA NO se queja, que es como se verifica que un campo
# opcional volvio a ser opcional sin tener que crear una cuenta.
pedir() {
  local desc="$1" extra="$2" modo="$3" texto="$4"
  local cuerpo respuesta

  cuerpo=$(printf '{"email":"humo-registro@example.com","password":"%s","firstName":"QA","lastName":"Humo","rut":"%s"%s}' \
    "$PASS_INVALIDA" "$RUT_VALIDO" "${extra:+,$extra}")

  respuesta=$(curl -s -X POST "$URL" -H 'Content-Type: application/json' -d "$cuerpo")

  if [ "$modo" = "ausente" ]; then
    if printf '%s' "$respuesta" | grep -qF "$texto"; then
      printf '  FALLA  %s\n         esperaba que YA NO dijera: %s\n         dijo: %s\n' "$desc" "$texto" "$respuesta"
      fallo=$((fallo + 1))
      return
    fi
  else
    if ! printf '%s' "$respuesta" | grep -qF "$texto"; then
      printf '  FALLA  %s\n         esperaba: %s\n         dijo: %s\n' "$desc" "$texto" "$respuesta"
      fallo=$((fallo + 1))
      return
    fi
  fi

  printf '  ok     %s\n' "$desc"
  ok=$((ok + 1))
}

printf '\nHumo del registro contra %s\n\n' "$API"

printf 'Campos opcionales que impedian registrarse\n'
# R-01. El campo se rotula «Teléfono (opcional)».
pedir 'R-01 · el telefono vacio ya no se queja' \
  '"phone":""' ausente 'teléfono'
# R-02. El paso 3 se titula «Datos opcionales».
pedir 'R-02 · la fecha de nacimiento vacia ya no se queja' \
  '"birthDate":""' ausente 'Fecha de nacimiento'
pedir 'R-02 · el paso 3 entero en blanco ya no se queja' \
  '"phone":"","birthDate":"","address":"","city":"","region":"","education":"","experience":""' \
  ausente 'Fecha de nacimiento'

printf '\nTelefono\n'
# R-04. El navegador validaba sin espacios y enviaba con espacios.
pedir 'R-04 · con espacios, como se escribe de verdad' \
  '"phone":"+56 9 1234 5678"' ausente 'teléfono'
pedir 'R-04 · prefijo de otro pais' \
  '"phone":"+1 415 555 0132"' ausente 'teléfono'
pedir 'sin prefijo, lo rechaza y dice que falta el prefijo' \
  '"phone":"912345678"' presente 'prefijo'
pedir 'mas de 15 digitos, lo rechaza' \
  '"phone":"+1234567890123456"' presente 'teléfono'

printf '\nRUT\n'
# R-05. El navegador aceptaba cualquier digito verificador.
pedir 'R-05 · digito verificador incorrecto, lo rechaza' \
  '"rut":"12345678-0"' presente 'dígito verificador'
# R-06. El texto de ayuda decia «sin puntos».
pedir 'R-06 · con puntos, como se escribe en Chile' \
  '"rut":"12.345.678-5"' ausente 'RUT'

printf '\nContrasena\n'
# R-03. El paso 1 prometia 6 caracteres.
pedir 'R-03 · el motivo es concreto, no generico' \
  '' presente '8 caracteres'

printf '\n  %d ok, %d fallas\n\n' "$ok" "$fallo"
[ "$fallo" -eq 0 ]
