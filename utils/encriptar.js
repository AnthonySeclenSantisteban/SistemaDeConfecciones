const bcrypt = require('bcrypt');

const encriptar = async (contra) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(contra, salt);
};

const verificar = async (contra, hash) => {
    return await bcrypt.compare(contra, hash);
};

module.exports = { encriptar, verificar };