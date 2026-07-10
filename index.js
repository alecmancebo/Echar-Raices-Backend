import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
import { conectarDB } from "./db.js";
import { verificarToken } from "./middleware.js";
import {
    marcarNarrativaCompletada,
    obtenerInventario,
    guardarItem,
    usarItem,
    dejarItem,
    obtenerEstadoJuego,
    guardarUltimaPantalla,
    reiniciarPartida,
} from "./datos.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const PUERTO = process.env.PORT || 4000;

const servidor = express();
servidor.use(cors());
servidor.use(express.json());

conectarDB();

// CARGAR DATOS DEL JUEGO
servidor.get("/api/juego/datos", verificarToken, async (req, res) => {
    try {
        const estadoJuego = await obtenerEstadoJuego(req.usuario.id);
        res.json(estadoJuego);
    } catch (error) {
        console.error("Error al obtener datos:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

servidor.patch("/api/juego/estado", verificarToken, async (req, res) => {
    try {
        const { ultimaPantalla, progreso } = req.body || {};

        const estado = await guardarUltimaPantalla(req.usuario.id, ultimaPantalla || "PLAYING");
        if (typeof progreso === "number") {
            const db = await conectarDB();
            await db.collection("juego_datos").updateOne(
                { user_id: new ObjectId(req.usuario.id) },
                {
                    $set: { progreso },
                    $unset: {
                        created_at: "",
                        updated_at: "",
                    },
                },
                { upsert: true }
            );
            return res.json(await obtenerEstadoJuego(req.usuario.id));
        }

        res.json(estado);
    } catch (error) {
        console.error("Error al guardar estado del juego:", error);
        res.status(500).json({ error: "Error al guardar estado del juego" });
    }
});

servidor.post("/api/juego/nueva-partida", verificarToken, async (req, res) => {
    try {
        const estado = await reiniciarPartida(req.usuario.id);
        res.json(estado);
    } catch (error) {
        console.error("Error al reiniciar la partida:", error);
        res.status(500).json({ error: "Error al reiniciar la partida" });
    }
});

// LOGIN
servidor.post("/api/login", async (req, res) => {
    const { usuario, password } = req.body;

    if (!usuario || !usuario.trim() || !password || !password.trim()) {
        return res.sendStatus(403);
    }

    try {
        const db = await conectarDB();
        const usuarioEncontrado = await db.collection("usuarios").findOne({ usuario });

        if (!usuarioEncontrado || !(await bcrypt.compare(password, usuarioEncontrado.password))) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign({ id: usuarioEncontrado._id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// MARCAR NARRATIVA COMPLETADA
servidor.patch("/api/usuario/narrativa", verificarToken, async (req, res) => {
    try {
        const resultado = await marcarNarrativaCompletada(req.usuario.id);
        if (resultado.matchedCount === 0) return res.status(404).json({ error: "Usuario no encontrado" });

        res.sendStatus(204);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar progreso" });
    }
});

// GUARDAR OBJETO EN INVENTARIO
servidor.post("/api/nuevo", verificarToken, async (req, res) => {
    try {
        const item = req.body?.item ?? req.body?.itemId ?? req.body?.id;
        if (!item) return res.status(400).json({ error: "Se requiere un item" });

        const items = await guardarItem(req.usuario.id, item);
        res.status(201).json({ items });
    } catch (error) {
        console.error("Error al crear elemento:", error);
        res.status(500).json({ error: "Error interno al crear el elemento" });
    }
});

// OBTENER INVENTARIO DEL USUARIO
servidor.get("/api/inventario", verificarToken, async (req, res) => {
    try {
        const items = await obtenerInventario(req.usuario.id);
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: "Error al recuperar datos" });
    }
});

// USAR OBJETO DEL INVENTARIO
servidor.patch("/api/inventario/usar", verificarToken, async (req, res) => {
    try {
        const item = req.body?.item ?? req.body?.itemId ?? req.body?.id;
        if (!item) return res.status(400).json({ error: "Se requiere un item" });

        const resultado = await usarItem(req.usuario.id, item);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el inventario" });
    }
});

// DEJAR OBJETO DEL INVENTARIO
servidor.post("/api/inventario/dejar", verificarToken, async (req, res) => {
    try {
        const item = req.body?.item ?? req.body?.itemId ?? req.body?.id;
        if (!item) return res.status(400).json({ error: "Se requiere un item" });

        const items = await dejarItem(req.usuario.id, item);
        res.json({ items });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el item" });
    }
});

// ELIMINAR OBJETO DEL INVENTARIO POR PARAMETRO
servidor.delete("/api/inventario/:itemId", verificarToken, async (req, res) => {
    try {
        const items = await dejarItem(req.usuario.id, req.params.itemId);
        res.json({ items });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el item" });
    }
});

servidor.listen(PUERTO, () => console.log(`Servidor corriendo en puerto ${PUERTO}`));