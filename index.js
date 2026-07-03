import dotenv from "dotenv";
dotenv.config();

const PUERTO = process.env.PORT || 4000;

import express from 'express';
import cors from 'cors';
import { conectarDB } from './db.js';
import { verificarToken } from "./middleware.js";
import { obtenerElementos, crearElemento } from "./datos.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const servidor = express();
servidor.use(cors());
servidor.use(express.json());

conectarDB();

// LOGIN
servidor.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;

    if(!usuario || !usuario.trim() || !password || !password.trim()){
    return respuesta.sendStatus(403);
    }

    try {
        const db = await conectarDB();
        const usuarioEncontrado = await db.collection("usuarios").findOne({ usuario });

        if (!usuarioEncontrado || !(await bcrypt.compare(password, usuarioEncontrado.password))) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign({ id: usuarioEncontrado._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});


servidor.get('/api/usuario/progreso', verificarToken, async (req, res) => {
    try {
        const usuario = await obtenerUsuarioPorId(req.usuarioId);
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
        
        res.json({ narrativaCompletada: !!usuario.narrativaCompletada });
    } catch (error) {
        res.status(500).json({ error: "Error interno al consultar progreso" });
    }
});


servidor.patch('/api/usuario/narrativa', verificarToken, async (req, res) => {
    try {
        const resultado = await marcarNarrativaCompletada(req.usuarioId);
        if (resultado.matchedCount === 0) return res.status(404).json({ error: "Usuario no encontrado" });
        
        res.sendStatus(204); 
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar progreso" });
    }
});

servidor.get('/api/raices', verificarToken, async (req, res) => {
    try {
        const raices = await obtenerElementos(req.usuarioId);
        res.json(raices);
    } catch (e) {
        res.status(500).json({ error: "Error al recuperar datos" });
    }
});

servidor.delete('/api/elementos/:id', verificarToken, async (req, res) => {
    try {
        const resultado = await borrarElemento(req.params.id, req.usuarioId);
        if (resultado.deletedCount === 0) return res.status(404).json({ error: "Elemento no encontrado" });
        res.sendStatus(204);
    } catch (e) {
        res.status(500).json({ error: "Error al borrar" });
    }
});

servidor.patch('/api/elementos/:id', verificarToken, async (req, res) => {
    try {
        const resultado = await actualizarElemento(req.params.id, req.usuarioId, req.body);
        if (resultado.matchedCount === 0) return res.status(404).json({ error: "Elemento no encontrado" });
        res.sendStatus(204);
    } catch (e) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});