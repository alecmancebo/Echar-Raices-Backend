import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

let usuarios = [
    {
        usuario: "alec",
        id: "1",
        password: "123"
    }
];

const urlmongo = process.env.MONGO_URL;

async function cargarUsuarios() {
    let conexion;
    try {
        conexion = await MongoClient.connect(urlmongo);
        const db = conexion.db("echar_raices");
        const coleccion = db.collection("usuarios");

        for (let u of usuarios) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(u.password, salt);

            const usuarioSeguro = {
                ...u,
                password: hash
            };

            await coleccion.updateOne(
                { usuario: usuarioSeguro.usuario },
                { $set: usuarioSeguro },
                { upsert: true }
            );

            console.log(`Usuario ${usuarioSeguro.usuario} procesado.`);
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        if (conexion) {
            await conexion.close();
            console.log("Conexion cerrada.");
        }
    }
}

cargarUsuarios();
