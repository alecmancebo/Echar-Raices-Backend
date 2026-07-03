import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const urlmongo = process.env.MONGO_URL;
let conexion;

export async function conectarDB() {
    if (conexion) return conexion;
    
    try {
        const cliente = await MongoClient.connect(urlmongo);
        conexion = cliente.db("echar_raices"); 
        console.log("Conectado a la base de datos local (MongoClient)");
        return conexion;
    } catch (error) {
        console.error("Error conectando a MongoDB", error);
        throw error;
    }
}