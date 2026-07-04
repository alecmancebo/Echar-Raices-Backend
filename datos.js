// datos.js
import { conectarDB } from "./db.js";
import { ObjectId } from "mongodb";

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

function convertirItem(itemDb) {
    return {
        id: itemDb.item_id,
        name: itemDb.name || String(itemDb.item_id).toUpperCase(),
        isUsed: Boolean(itemDb.is_used),
    };
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

    const existe = await db.collection("user_items").findOne({
        user_id: new ObjectId(usuarioId),
        ...construirQueryItem(itemId),
    });

    if (!existe) {
        await db.collection("user_items").insertOne({
            user_id: new ObjectId(usuarioId),
            item_id: itemId,
            is_used: false,
            created_at: new Date(),
        });
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

    return await obtenerInventario(usuarioId);
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
            created_at: new Date(),
        });
    }

    return {
        items: await obtenerInventario(usuarioId),
        progreso: estado?.progreso || 1,
        ultimaPantalla: estado?.ultimaPantalla || "PLAYING",
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

    await db.collection("juego_datos").deleteOne({ user_id: new ObjectId(usuarioId) });

    return {
        items: [],
        progreso: 1,
        ultimaPantalla: "PLAYING",
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