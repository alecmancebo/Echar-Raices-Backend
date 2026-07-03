import bcrypt from 'bcrypt';

async function generar() {
    const hash = await bcrypt.hash("123", 10);
    console.log("EL HASH ES:", hash);
}
generar();