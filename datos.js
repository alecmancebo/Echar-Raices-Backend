// datos.js
import { conectarDB } from "./db.js";
import { ObjectId } from "mongodb";

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
    return await db.collection("usuarios").updateOne(
        { _id: new ObjectId(usuarioId) },
        { $set: { narrativaCompletada: true } }
    );
}

export async function obtenerElementos(usuarioId) {
    const db = await conectarDB();
    return await db.collection("elementos").find({ usuarioId: new ObjectId(usuarioId) }).toArray();
}

export async function crearElemento(elemento) {
    const db = await conectarDB();
    return await db.collection("elementos").insertOne(elemento);
}

export async function actualizarElemento(id, usuarioId, cambios) {
    const db = await conectarDB();
    return await db.collection("elementos").updateOne(
        { _id: new ObjectId(id), usuarioId: new ObjectId(usuarioId) },
        { $set: cambios }
    );
}

export async function borrarElemento(id, usuarioId) {
    const db = await conectarDB();
    return await db.collection("elementos").deleteOne({ 
        _id: new ObjectId(id), 
        usuarioId: new ObjectId(usuarioId) 
    });
}