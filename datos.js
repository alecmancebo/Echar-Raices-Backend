// datos.js
import { conectarDB } from "./db.js";
import { ObjectId } from "mongodb";

const ITEM_ITINERARIOS = {
    botas: "c",
    pajaro: "a",
    sal: "c",
    pociones: "c",
    regadera: "a",
    tijeras: "b",
    rana: "b",
    rastrillo: "a",
    fuego: "b",
    herbicida: "c",
    maceta: "a",
    sombrilla: "b",
};

function normalizarItem(item) {
    if (!item) throw new Error("Se requiere un item");

    if (typeof item === "object") {
        return String(item.item || item.itemId || item.id || "").trim().toLowerCase();
    }

    return String(item).trim().toLowerCase();
}

function construirQueryItem(itemId) {
    const valor = normalizarItem(itemId);
    return {
        item_id: { $regex: new RegExp(`^${valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
    };
}

function obtenerItinerario(item) {
    if (!item) return null;

    if (typeof item === "object") {
        const itinerary = item.itinerary || item.itinerario;
        if (itinerary) return String(itinerary).trim().toLowerCase();

        const itemId = item.item || item.itemId || item.id || item.name;
        return ITEM_ITINERARIOS[normalizarItem(itemId)] || null;
    }

    return ITEM_ITINERARIOS[normalizarItem(item)] || null;
}

function convertirItem(itemDb) {
    return {
        id: itemDb.item_id,
        name: itemDb.name || String(itemDb.item_id).toUpperCase(),
        isUsed: Boolean(itemDb.is_used),
        itinerary: itemDb.itinerary || null,
    };
}

function normalizarItinerario(valor) {
    if (!valor) return null;
    const itinerario = String(valor).trim().toLowerCase();
    return ["a", "b", "c"].includes(itinerario) ? itinerario : null;
}

function calcularGanadorItinerario(uso, umbrales = {}) {
    const itinerarios = ["a", "b", "c"];
    const totalUsos = itinerarios.reduce((sum, itinerario) => sum + Number(uso?.[itinerario] || 0), 0);

    if (totalUsos < 4) return null;

    const maximo = Math.max(...itinerarios.map((itinerario) => Number(uso?.[itinerario] || 0)));
    const empatados = itinerarios.filter((itinerario) => Number(uso?.[itinerario] || 0) === maximo);

    if (empatados.length === 1) return empatados[0];

    const ordenados = empatados
        .map((itinerario) => ({
            itinerario,
            alcanzadoEn: Number(umbrales?.[itinerario]) || Number.MAX_SAFE_INTEGER,
        }))
        .sort((izquierda, derecha) => {
            if (izquierda.alcanzadoEn !== derecha.alcanzadoEn) return izquierda.alcanzadoEn - derecha.alcanzadoEn;
            return itinerarios.indexOf(izquierda.itinerario) - itinerarios.indexOf(derecha.itinerario);
        });

    return ordenados[0]?.itinerario || null;
}

export async function obtenerUsoItinerarios(usuarioId) {
    const db = await conectarDB();
    const estado = await db.collection("juego_datos").findOne(
        { user_id: new ObjectId(usuarioId) },
        { projection: { itineraryUsage: 1, itineraryThresholds: 1, winningItinerary: 1 } }
    );

    const usage = {
        a: Number(estado?.itineraryUsage?.a) || 0,
        b: Number(estado?.itineraryUsage?.b) || 0,
        c: Number(estado?.itineraryUsage?.c) || 0,
    };

    const thresholds = {
        a: estado?.itineraryThresholds?.a ?? null,
        b: estado?.itineraryThresholds?.b ?? null,
        c: estado?.itineraryThresholds?.c ?? null,
    };

    return {
        itineraryUsage: usage,
        itineraryThresholds: thresholds,
        winningItinerary: estado?.winningItinerary || calcularGanadorItinerario(usage, thresholds),
    };
}

export async function actualizarUsoItinerarios(usuarioId, uso, umbrales = null) {
    const db = await conectarDB();
    const siguiente = {
        a: Number(uso?.a) || 0,
        b: Number(uso?.b) || 0,
        c: Number(uso?.c) || 0,
    };

    const estadoActual = await db.collection("juego_datos").findOne({ user_id: new ObjectId(usuarioId) });
    const thresholds = {
        a: umbrales?.a ?? estadoActual?.itineraryThresholds?.a ?? null,
        b: umbrales?.b ?? estadoActual?.itineraryThresholds?.b ?? null,
        c: umbrales?.c ?? estadoActual?.itineraryThresholds?.c ?? null,
    };
    const ganador = calcularGanadorItinerario(siguiente, thresholds);

    await db.collection("juego_datos").updateOne(
        { user_id: new ObjectId(usuarioId) },
        {
            $set: {
                itineraryUsage: siguiente,
                itineraryThresholds: thresholds,
                winningItinerary: ganador,
                updated_at: new Date(),
            },
        },
        { upsert: true }
    );

    return {
        itineraryUsage: siguiente,
        itineraryThresholds: thresholds,
        winningItinerary: ganador,
    };
}

export async function incrementarUsoItinerario(usuarioId, item) {
    const itinerario = normalizarItinerario(obtenerItinerario(item));
    if (!itinerario) {
        return await obtenerUsoItinerarios(usuarioId);
    }

    const estadoActual = await obtenerUsoItinerarios(usuarioId);
    const siguiente = {
        ...estadoActual.itineraryUsage,
        [itinerario]: (estadoActual.itineraryUsage[itinerario] || 0) + 1,
    };
    const umbrales = {
        ...estadoActual.itineraryThresholds,
        [itinerario]: estadoActual.itineraryThresholds?.[itinerario] ?? (siguiente[itinerario] >= 4 ? Date.now() : null),
    };

    return await actualizarUsoItinerarios(usuarioId, siguiente, umbrales);
}

export async function obtenerEstadoUsuario(usuarioId) {
    const db = await conectarDB();
    const usuario = await db.collection("usuarios").findOne(
        { _id: new ObjectId(usuarioId) },
        { projection: { narrativaCompletada: 1 } }
    );
    return usuario;
}

export async function marcarNarrativaCompletada(usuarioId) {
    const db = await conectarDB();
    return await db.collection("juego_datos").updateOne(
        { user_id: new ObjectId(usuarioId) },
        { $set: { narrativaCompletada: true } },
        { upsert: true }
    );
}

export async function obtenerInventario(usuarioId) {
    const db = await conectarDB();
    const items = await db.collection("user_items").find({ user_id: new ObjectId(usuarioId) }).toArray();
    return items.map(convertirItem);
}

export async function guardarItem(usuarioId, item) {
    const db = await conectarDB();
    const itemId = normalizarItem(item);
    const itinerary = obtenerItinerario(item);

    const existe = await db.collection("user_items").findOne({
        user_id: new ObjectId(usuarioId),
        ...construirQueryItem(itemId),
    });

    if (!existe) {
        await db.collection("user_items").insertOne({
            user_id: new ObjectId(usuarioId),
            item_id: itemId,
            itinerary,
            is_used: false,
            created_at: new Date(),
        });
    } else if (itinerary && existe.itinerary !== itinerary) {
        await db.collection("user_items").updateOne(
            {
                user_id: new ObjectId(usuarioId),
                ...construirQueryItem(itemId),
            },
            {
                $set: {
                    itinerary,
                    updated_at: new Date(),
                },
            }
        );
    }

    return await obtenerInventario(usuarioId);
}

export async function usarItem(usuarioId, item) {
    const db = await conectarDB();
    const itemId = normalizarItem(item);

    await db.collection("user_items").updateOne(
        {
            user_id: new ObjectId(usuarioId),
            ...construirQueryItem(itemId),
        },
        {
            $set: {
                is_used: true,
                updated_at: new Date(),
            },
        },
        { upsert: true }
    );

    const itinerarios = await incrementarUsoItinerario(usuarioId, item);

    return {
        items: await obtenerInventario(usuarioId),
        itineraryUsage: itinerarios.itineraryUsage,
        itineraryThresholds: itinerarios.itineraryThresholds,
        winningItinerary: itinerarios.winningItinerary,
    };
}

export async function dejarItem(usuarioId, item) {
    const db = await conectarDB();
    const itemId = normalizarItem(item);

    await db.collection("user_items").deleteOne({
        user_id: new ObjectId(usuarioId),
        ...construirQueryItem(itemId),
    });

    return await obtenerInventario(usuarioId);
}

export async function obtenerEstadoJuego(usuarioId) {
    const db = await conectarDB();
    const estado = await db.collection("juego_datos").findOne({ user_id: new ObjectId(usuarioId) });

    if (!estado) {
        await db.collection("juego_datos").insertOne({
            user_id: new ObjectId(usuarioId),
            progreso: 1,
            ultimaPantalla: "PLAYING",
            itineraryUsage: {
                a: 0,
                b: 0,
                c: 0,
            },
            created_at: new Date(),
        });
    }

    const itinerarios = await obtenerUsoItinerarios(usuarioId);

    return {
        items: await obtenerInventario(usuarioId),
        progreso: estado?.progreso || 1,
        ultimaPantalla: estado?.ultimaPantalla || "PLAYING",
        itineraryUsage: itinerarios.itineraryUsage,
        itineraryThresholds: itinerarios.itineraryThresholds,
        winningItinerary: itinerarios.winningItinerary,
    };
}

export async function actualizarEstadoJuego(usuarioId, cambios) {
    const db = await conectarDB();
    await db.collection("juego_datos").updateOne(
        { user_id: new ObjectId(usuarioId) },
        { $set: cambios },
        { upsert: true }
    );

    return await obtenerEstadoJuego(usuarioId);
}

export async function guardarUltimaPantalla(usuarioId, pantalla) {
    const db = await conectarDB();
    const valor = String(pantalla || "PLAYING").trim();

    await db.collection("juego_datos").updateOne(
        { user_id: new ObjectId(usuarioId) },
        {
            $set: {
                ultimaPantalla: valor,
                updated_at: new Date(),
            },
        },
        { upsert: true }
    );

    return await obtenerEstadoJuego(usuarioId);
}

export async function reiniciarPartida(usuarioId) {
    const db = await conectarDB();

    await db.collection("user_items").deleteMany({ user_id: new ObjectId(usuarioId) });

    await db.collection("juego_datos").updateOne(
        { user_id: new ObjectId(usuarioId) },
        {
            $set: {
                progreso: 1,
                ultimaPantalla: "PLAYING",
                itineraryUsage: {
                    a: 0,
                    b: 0,
                    c: 0,
                },
                updated_at: new Date(),
            },
        },
        { upsert: true }
    );

    return {
        items: [],
        progreso: 1,
        ultimaPantalla: "PLAYING",
        itineraryUsage: {
            a: 0,
            b: 0,
            c: 0,
        },
        itineraryThresholds: {
            a: null,
            b: null,
            c: null,
        },
        winningItinerary: null,
    };
}

export async function obtenerElementos(usuarioId) {
    return await obtenerInventario(usuarioId);
}

export async function crearElemento(elemento) {
    return await guardarItem(elemento.usuarioId || elemento.userId, elemento.item || elemento.itemId || elemento.id);
}

export async function actualizarElemento(id, usuarioId, cambios) {
    const db = await conectarDB();
    return await db.collection("user_items").updateOne(
        { _id: new ObjectId(id), user_id: new ObjectId(usuarioId) },
        { $set: cambios }
    );
}

export async function borrarElemento(id, usuarioId) {
    const db = await conectarDB();
    return await db.collection("user_items").deleteOne({
        _id: new ObjectId(id),
        user_id: new ObjectId(usuarioId),
    });
}