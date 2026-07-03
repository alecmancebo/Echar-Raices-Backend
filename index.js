import dotenv from "dotenv";
dotenv.config();

const PUERTO = process.env.PORT || 4000;

import express from 'express';
import cors from 'cors';
import { conectarDB } from './db.js';
import { verificarToken } from "./middleware.js";
import { obtenerElementos, crearElemento, obtenerEstadoUsuario, marcarNarrativaCompletada, borrarElemento, actualizarElemento } from "./datos.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const servidor = express();
servidor.use(cors());
servidor.use(express.json());

conectarDB();

servidor.use(express.static("./front"));

// LOGIN
servidor.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;

    if(!usuario || !usuario.trim() || !password || !password.trim()){
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

//PROGRESO DE NARRATIVA
servidor.get('/api/usuario/progreso', verificarToken, async (req, res) => {
    try {
        const usuario = await obtenerEstadoUsuario(req.usuarioId);
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
        
        res.json({ narrativaCompletada: !!usuario.narrativaCompletada });
    } catch (error) {
        res.status(500).json({ error: "Error interno al consultar progreso" });
    }
});

// MARCAR NARRATIVA COMPLETADA
servidor.patch('/api/usuario/narrativa', verificarToken, async (req, res) => {
    try {
        const resultado = await marcarNarrativaCompletada(req.usuarioId);
        if (resultado.matchedCount === 0) return res.status(404).json({ error: "Usuario no encontrado" });
        
        res.sendStatus(204); 
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar progreso" });
    }
});

// CREAR ELEMENTO (GUARDAR OBJETO EN INVENTARIO)
servidor.post('/api/nuevo', verificarToken, async (req, res) => {
    try {
        const nuevoElemento = req.body;
        nuevoElemento.usuarioId = req.usuarioId; 
        const resultado = await crearElemento(nuevoElemento);
        res.status(201).json({ id: resultado.insertedId });
    } catch (error) {
        console.error("Error al crear elemento:", error);
        res.status(500).json({ error: "Error interno al crear el elemento" });
    }
});

// OBJETOS INVENTARIO
servidor.get('/api/elementos', verificarToken, async (req, res) => {
    try {
        const raices = await obtenerElementos(req.usuarioId);
        res.json(raices);
    } catch (e) {
        res.status(500).json({ error: "Error al recuperar datos" });
    }
});

// BORRAR ELEMENTO (ELIMINAR OBJETO DEL INVENTARIO)
servidor.delete('/api/elementos/:id', verificarToken, async (req, res) => {
    try {
        const resultado = await borrarElemento(req.params.id, req.usuarioId);
        if (resultado.deletedCount === 0) return res.status(404).json({ error: "Elemento no encontrado" });
        res.sendStatus(204);
    } catch (e) {
        res.status(500).json({ error: "Error al borrar" });
    }
});

// ACTUALIZAR ELEMENTO (USAR OBJETO DEL INVENTARIO)
servidor.patch('/api/elementos/:id', verificarToken, async (req, res) => {
    try {
        const resultado = await actualizarElemento(req.params.id, req.usuarioId, req.body);
        if (resultado.matchedCount === 0) return res.status(404).json({ error: "Elemento no encontrado" });
        res.sendStatus(204);
    } catch (e) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});

servidor.listen(PUERTO, () => console.log(`Servidor corriendo en puerto ${PUERTO}`));