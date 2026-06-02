const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'confeccioneslix@gmail.com',
        pass: 'o e l o v l n a a c a i x i v k' 
    }
});
 

async function enviarConfirmacionPedido({ correo, nombre, numeroVenta, tipoDoc, total, items, metodoPago }) {
    const tipoLabel = tipoDoc === 'boleta' ? 'Boleta' : 'Nota de Venta';
    const itemsHtml = items.map(i =>
        `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${i.nombre}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${i.cantidad}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">S/ ${Number(i.precio_unitario).toFixed(2)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">S/ ${Number(i.subtotal).toFixed(2)}</td>
        </tr>`
    ).join('');
 
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:#1a3c5e;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">✅ Pedido Confirmado</h1>
            <p style="color:#a8d0f0;margin:6px 0 0;">Confecciones Lix</p>
        </div>
        <div style="padding:24px;">
            <p>Hola <strong>${nombre}</strong>,</p>
            <p>Tu pedido ha sido recibido y estamos procesando el pago. Aquí está el resumen:</p>
 
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr style="background:#f5f5f5;">
                    <td style="padding:8px 10px;"><strong>N° ${tipoLabel}</strong></td>
                    <td style="padding:8px 10px;"><strong>${numeroVenta}</strong></td>
                </tr>
                <tr>
                    <td style="padding:8px 10px;">Método de pago</td>
                    <td style="padding:8px 10px;">${metodoPago}</td>
                </tr>
            </table>
 
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <thead>
                    <tr style="background:#1a3c5e;color:#fff;">
                        <th style="padding:8px 10px;text-align:left;">Producto</th>
                        <th style="padding:8px 10px;text-align:center;">Cant.</th>
                        <th style="padding:8px 10px;text-align:right;">P. Unit.</th>
                        <th style="padding:8px 10px;text-align:right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr style="background:#f5f5f5;">
                        <td colspan="3" style="padding:10px;text-align:right;font-weight:bold;">TOTAL</td>
                        <td style="padding:10px;text-align:right;font-weight:bold;color:#1a3c5e;">S/ ${Number(total).toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
 
            <div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;margin-top:20px;border-radius:4px;">
                <p style="margin:0;font-size:14px;">⚠️ <strong>Siguiente paso:</strong> Envíanos el comprobante de pago por WhatsApp al <strong>945 952 450</strong> o responde este correo con la captura.</p>
            </div>
 
            <p style="margin-top:24px;color:#666;font-size:13px;">Gracias por confiar en Confecciones Lix. Nos contactaremos contigo para coordinar la entrega.</p>
        </div>
        <div style="background:#f5f5f5;padding:14px;text-align:center;font-size:12px;color:#999;">
            Confecciones Lix · Chiclayo, Perú · 945 952 450
        </div>
    </div>`;
 
    await transporter.sendMail({
        from: '"Confecciones Lix" <confeccioneslix@gmail.com>',
        to: correo,
        subject: `✅ Pedido confirmado - ${numeroVenta}`,
        html
    });
}
 
module.exports = { enviarConfirmacionPedido };