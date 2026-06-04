const multer = require('multer');
const path = require('path');
const fs = require('fs');

function crearStorage(subcarpeta) {
    const destino = path.join(__dirname, '../public/uploads', subcarpeta);

    if (!fs.existsSync(destino)) {
        fs.mkdirSync(destino, { recursive: true });
    }

    return multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, destino);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const base = path.basename(file.originalname, ext)
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9-_]/g, '')
                .toLowerCase();

            cb(null, `${base}-${Date.now()}${ext}`);
        }
    });
}

function filtroImagen(req, file, cb) {
    const tipos = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!tipos.includes(file.mimetype)) {
        return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
    }
    cb(null, true);
}

const uploadLogo = multer({
    storage: crearStorage('logos'),
    fileFilter: filtroImagen,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadSlider = multer({
    storage: crearStorage('sliders'),
    fileFilter: filtroImagen,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { uploadLogo, uploadSlider };