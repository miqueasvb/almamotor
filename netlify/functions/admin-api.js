
const RUTA_JSON = "data/vehiculos.json";

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return respuesta(405, { error: "Método no permitido" });
    }

    let body;
    try {
        body = JSON.parse(event.body || "{}");
    } catch (e) {
        return respuesta(400, { error: "Cuerpo de la petición inválido" });
    }

    const { ADMIN_USER, ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;

    if (!ADMIN_USER || !ADMIN_PASSWORD || !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
        return respuesta(500, { error: "El panel todavía no está configurado del lado del servidor (faltan variables de entorno en Netlify)." });
    }

    if (body.usuario !== ADMIN_USER || body.password !== ADMIN_PASSWORD) {
        return respuesta(401, { error: "Usuario o contraseña incorrectos." });
    }

    const branch = GITHUB_BRANCH || "main";
    const ghHeaders = {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    };
    const ghBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

    try {
        switch (body.accion) {

            case "listar": {
                const r = await fetch(`${ghBase}/${RUTA_JSON}?ref=${branch}`, { headers: ghHeaders });
                if (r.status === 404) {
                    return respuesta(200, { vehiculos: [], sha: null });
                }
                if (!r.ok) {
                    const e = await r.json().catch(() => ({}));
                    return respuesta(r.status, { error: e.message || "No se pudo leer el catálogo" });
                }
                const data = await r.json();
                const contenido = Buffer.from(data.content, "base64").toString("utf-8");
                return respuesta(200, { vehiculos: JSON.parse(contenido), sha: data.sha });
            }

            case "subirFoto": {
                const { id, nombreArchivo, base64 } = body;
                if (!id || !nombreArchivo || !base64) {
                    return respuesta(400, { error: "Faltan datos para subir la foto." });
                }
                const path = `img/vehiculos/${id}/${nombreArchivo}`;
                const r = await fetch(`${ghBase}/${path}`, {
                    method: "PUT",
                    headers: ghHeaders,
                    body: JSON.stringify({
                        message: `Agregar foto (${id})`,
                        content: base64,
                        branch
                    })
                });
                if (!r.ok) {
                    const e = await r.json().catch(() => ({}));
                    return respuesta(r.status, { error: e.message || "Error subiendo la foto" });
                }
                return respuesta(200, { path });
            }

            case "guardarJson": {
                const { vehiculos, sha, mensaje } = body;
                if (!Array.isArray(vehiculos)) {
                    return respuesta(400, { error: "Formato de catálogo inválido." });
                }
                const contenido = Buffer.from(JSON.stringify(vehiculos, null, 2), "utf-8").toString("base64");
                const put = { message: mensaje || "Actualizar catálogo", content: contenido, branch };
                if (sha) put.sha = sha;

                const r = await fetch(`${ghBase}/${RUTA_JSON}`, {
                    method: "PUT",
                    headers: ghHeaders,
                    body: JSON.stringify(put)
                });
                if (!r.ok) {
                    const e = await r.json().catch(() => ({}));
                    return respuesta(r.status, { error: e.message || "No se pudo guardar el catálogo" });
                }
                const data = await r.json();
                return respuesta(200, { sha: data.content.sha });
            }

            default:
                return respuesta(400, { error: "Acción desconocida." });
        }
    } catch (e) {
        return respuesta(500, { error: "Error inesperado: " + e.message });
    }
};

function respuesta(statusCode, objeto) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objeto)
    };
}
