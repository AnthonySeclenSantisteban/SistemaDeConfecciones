

create type estado_pedido as enum (
    'pendiente',
    'procesando',
    'enviado',
    'entregado',
    'cancelado'
);

create type tipo_movimiento as enum ('entrada', 'salida');

create type estado_pago as enum ('pendiente', 'pagado');

create type tipo_entrega as enum ('delivery', 'recojo_tienda');

create type estado_entrega as enum (
    'pendiente',
    'en_camino',
    'entregado',
    'demora',
    'fallido'
);

create type tipo_comprobante as enum (
    'yape',
    'plin',
    'transferencia',
    'efectivo',
    'otro'
);

create type estado_carrito as enum (
    'activo',
    'comprado'
);

create type genero_uniforme as enum (
    'masculino',
    'femenino',
    'unisex'
);



create table clientes (
    id_cliente serial primary key,
    nombres varchar(100) not null,
    apellidos varchar(100),
    telefono varchar(15),
    correo varchar(100),
    fecha_registro timestamp default current_timestamp
);

create table categorias(
    idcategoria serial primary key,
    nombre_categoria varchar(100) not null
);

create table usuarios (
    id_usuario serial primary key,
    nombre varchar(100) not null,
    correo varchar(100) unique not null,
    contrasena varchar(255) not null,
    fecha_registro timestamp default current_timestamp
);

create table tallas (
    id_talla serial primary key,
    nombre_talla varchar(10) not null unique
);

create table tipos_uniforme (
    id_tipo serial primary key,
    nombre_tipo varchar(50) not null unique
);



create table productos (
    id_producto serial primary key,
    nombre_producto varchar(100) not null,
    descripcion text,
    precio numeric(10,2) not null,
    id_categoria integer,
    genero genero_uniforme,
    id_tipo integer,
    foreign key (id_categoria) references categorias(idcategoria),
    foreign key (id_tipo) references tipos_uniforme(id_tipo)
);

create table direcciones_cliente(
    id_direccion serial primary key,
    id_cliente integer not null,
    direccion varchar(250) not null,
    distrito varchar(100),
    provincia varchar(100),
    referencia varchar(150),
    direcc_principal boolean default false,
    foreign key(id_cliente) references clientes(id_cliente)
);



create table pedidos (
    id_pedido serial primary key,
    id_cliente integer not null,
    fecha_pedido timestamp default current_timestamp,
    total numeric(10,2),
    estado estado_pedido default 'pendiente',
    id_direccion integer,
    foreign key (id_cliente) references clientes(id_cliente),
    foreign key (id_direccion) references direcciones_cliente(id_direccion)
);

create table variantes_producto (
    id_variante serial primary key,
    id_producto integer not null,
    id_talla integer,
    color varchar(40) not null,
    stock integer not null default 0 check (stock >= 0),
    precio_extra numeric(10,2) default 0.00,
    foreign key (id_producto) references productos(id_producto),
    foreign key (id_talla) references tallas(id_talla),
    unique (id_producto, id_talla, color)
);

create table detalle_pedido (
    id_detalle serial primary key,
    id_pedido integer not null,
    id_producto integer not null,
    id_variante integer,
    cantidad integer not null,
    precio_unitario numeric(10,2) not null,
    subtotal numeric(10,2) not null,
    foreign key (id_pedido) references pedidos(id_pedido),
    foreign key (id_producto) references productos(id_producto),
    foreign key (id_variante) references variantes_producto(id_variante),
    constraint chk_cantidad_detalle check (cantidad > 0)
);

create table pagos (
    id_pago serial primary key,
    id_pedido integer,
    metodo_pago varchar(50),
    monto numeric(10,2),
    fecha_pago timestamp default current_timestamp,
    estado estado_pago default 'pendiente',
    foreign key (id_pedido) references pedidos(id_pedido)
);

create table comprobantes_pago (
    id_comprobante serial primary key,
    id_pago integer not null,
    tipo_comprobante tipo_comprobante not null,
    numero_operacion varchar(110) unique,
    evidencia text not null,
    fecha_operacion timestamp not null,
    monto_confirmado numeric(10,2) not null default 0.00,
    validado_por integer,
    fecha_validacion timestamp,
    creado_en timestamp default current_timestamp,
    foreign key (id_pago) references pagos(id_pago),
    foreign key (validado_por) references usuarios(id_usuario),
    constraint chk_validacion_completa
    check (
        (validado_por is null and fecha_validacion is null) or
        (validado_por is not null and fecha_validacion is not null)
    )
);

create table movimiento_stock (
    id_movimiento serial primary key,
    id_producto integer not null,
    id_variante integer not null,
    tipo_movimiento tipo_movimiento not null,
    cantidad integer not null check (cantidad > 0),
    fecha_movimiento timestamp default current_timestamp,
    motivo varchar(100) not null,
    foreign key (id_producto) references productos(id_producto),
    foreign key (id_variante) references variantes_producto(id_variante)
);

create table compras_insumos (
    id_compra serial primary key,
    nombre_insumo varchar(100) not null,
    cantidad integer not null check (cantidad > 0),
    unidad_medida varchar(20) not null,
    costo numeric(10,2) not null check (costo >= 0),
    lugar_compra varchar(100) not null,
    fecha_compra timestamp default current_timestamp,
    id_usuario integer,
    foreign key (id_usuario) references usuarios(id_usuario)
);

create table envios (
    id_envio serial primary key,
    id_pedido integer not null,
    tipo_entrega tipo_entrega not null,
    id_direccion integer,
    fecha_estimada date,
    fecha_entrega timestamp,
    estado_entrega estado_entrega default 'pendiente',
    observaciones varchar(255),
    foreign key (id_pedido) references pedidos(id_pedido),
    foreign key (id_direccion) references direcciones_cliente(id_direccion)
);

create table carrito (
    id_carrito serial primary key,
    id_cliente integer not null,
    fecha_creacion timestamp default current_timestamp,
    fecha_actualizacion timestamp default current_timestamp,
    estado estado_carrito default 'activo',
    foreign key (id_cliente) references clientes(id_cliente)
);

create table detalle_carrito (
    id_detalle_carrito serial primary key,
    id_carrito integer not null,
    id_producto integer not null,
    id_variante integer,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(10,2) not null,
    subtotal numeric(10,2) not null,
    agregado_en timestamp default current_timestamp,
    foreign key (id_carrito) references carrito(id_carrito),
    foreign key (id_producto) references productos(id_producto),
    foreign key (id_variante) references variantes_producto(id_variante),
    constraint uq_carrito unique (id_carrito, id_producto, id_variante)
);

create table imagenes_producto (
    id_imagen serial primary key,
    id_producto integer not null,
    url_imagen text not null,
    foreign key (id_producto) references productos(id_producto)
);


alter table clientes
add column id_usuario integer unique;

alter table clientes
add constraint fk_cliente_usuario
foreign key (id_usuario) references usuarios(id_usuario);


alter table pedidos
add column codigo_seguimiento varchar(50) unique;

create table colegios (
    id_colegio serial primary key,
    nombre_colegio varchar(150) not null,
    distrito varchar(100),
    provincia varchar(100)
);

alter table productos
add column id_colegio integer,
add constraint fk_producto_colegio
foreign key (id_colegio) references colegios(id_colegio);

create table metodos_pago_empresa (
    id_metodo serial primary key,
    tipo tipo_comprobante not null,
    nombre_titular varchar(100) not null,
    numero_cuenta varchar(100),
    numero_telefono varchar(15),
    activo boolean default true
);

alter table usuarios drop column rol;


create table perfiles (
    id_perfil serial primary key,
    nombre varchar(50) not null unique,
	descripcion varchar(120) not null
);

create table opciones (
    id_opcion serial primary key,
    nombre varchar(100) not null,
    ruta varchar(100),
    icono varchar(50),

    created_at timestamp default current_timestamp,
    created_by integer,
    deleted_at timestamp,
    deleted_by integer,

    constraint fk_opcion_created_by foreign key (created_by) references usuarios(id_usuario),
    constraint fk_opcion_deleted_by foreign key (deleted_by) references usuarios(id_usuario)
);

create table perfiles_opciones (
    id_perfil integer,
    id_opcion integer,

    created_at timestamp default current_timestamp,
    created_by integer,
    deleted_at timestamp,
    deleted_by integer,

    primary key (id_perfil, id_opcion),

    constraint fk_po_perfil foreign key (id_perfil) references perfiles(id_perfil),
    constraint fk_po_opcion foreign key (id_opcion) references opciones(id_opcion),

    constraint fk_po_created_by foreign key (created_by) references usuarios(id_usuario),
    constraint fk_po_deleted_by foreign key (deleted_by) references usuarios(id_usuario)
);

alter table usuarios
add column id_perfil integer;

alter table usuarios
add constraint fk_usuario_perfil
foreign key (id_perfil)
references perfiles(id_perfil)
on delete restrict;

alter table usuarios
alter column id_perfil set not null;

alter table perfiles
add column created_at timestamp default current_timestamp,
add column created_by integer,
add column deleted_at timestamp,
add column deleted_by integer;

alter table perfiles
add constraint fk_perfil_created_by
foreign key (created_by)
references usuarios(id_usuario)
on delete set null;

alter table perfiles
add constraint fk_perfil_deleted_by
foreign key (deleted_by)
references usuarios(id_usuario)
on delete set null;

insert into usuarios (nombre, correo, contrasena, id_perfil)
VALUES (
    'Admin',
    'admin@admin.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh32',
    1
);
insert into perfiles (nombre, descripcion) values
('Administrador', 'Acceso total al sistema'),
('Vendedor', 'Gestiona ventas y pedidos'),
('Cliente', 'Realiza compras en nues'),
('Invitado', 'Solo visualiza');


INSERT INTO usuarios (nombre, correo, contrasena, id_perfil)
VALUES (
    'diegodxi',
    'diegodxi@admin.com',
    '$2b$10$aCF6jz0irKjhUunbno0XU.yJwIGBEoJFZ13vPP1dDlPeK9SJmXR0m',
    1
);


ALTER TABLE usuarios
ADD COLUMN estado smallint NOT NULL DEFAULT 1
    CONSTRAINT chk_estado_usuario CHECK (estado IN (0, 1, 2));

COMMENT ON COLUMN usuarios.estado IS '0 = inactivo | 1 = activo | 2 = eliminado';


ALTER TABLE perfiles
ADD COLUMN estado smallint NOT NULL DEFAULT 1
    CONSTRAINT chk_estado_perfil CHECK (estado IN (0, 1, 2));

COMMENT ON COLUMN perfiles.estado IS '0 = inactivo | 1 = activo | 2 = eliminado';

SELECT u.*, p.nombre AS perfil_nombre
FROM usuarios u
JOIN perfiles p ON p.id_perfil = u.id_perfil
WHERE u.correo = 'admin@admin.com' AND u.estado = 1




ALTER TABLE categorias
RENAME COLUMN nombre_categoria TO nombre;

ALTER TABLE categorias
RENAME COLUMN idcategoria TO id_categoria;

ALTER TABLE categorias
ADD COLUMN descripcion varchar(200),
ADD COLUMN estado smallint NOT NULL DEFAULT 1
    CONSTRAINT chk_estado_categoria CHECK (estado IN (0, 1, 2)),
ADD COLUMN fecha_registro timestamp DEFAULT current_timestamp,
ADD COLUMN created_by integer,
ADD COLUMN updated_at timestamp,
ADD COLUMN updated_by integer,
ADD COLUMN deleted_at timestamp,
ADD COLUMN deleted_by integer;

COMMENT ON COLUMN categorias.estado IS '0 = inactivo | 1 = activo | 2 = eliminado';

ALTER TABLE categorias
ADD CONSTRAINT fk_categoria_created_by
    FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_categoria_updated_by
    FOREIGN KEY (updated_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_categoria_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

//
INSERT INTO categorias (nombre, descripcion, estado, created_by) VALUES
('Polo', 'Polos escolares de educación física', 1, 1),
('Camisa', 'Camisas escolares formales para niños y adolecentes ', 1, 1),
('Blusa', 'Blusas escolares formales para niñas y adolecentes', 1, 1),
('Pantalón', 'Pantalones escolares formales', 1, 1),
('Falda', 'Faldas escolares formales', 1, 1),
('Short', 'Shorts deportivos escolares para educacion física', 1, 1),
('Buzo', 'Buzo escolar de educacion física', 1, 1),
('Chompa', 'Chompas escolares', 1, 1),
('Casaca', 'Casacas escolares de educacion física', 1, 1),
('Accesorios', 'Corbatas, cinturones y accesorios escolares personalizados', 1, 1);


ALTER TABLE productos
ADD COLUMN estado smallint NOT NULL DEFAULT 1
    CONSTRAINT chk_estado_producto CHECK (estado IN (0, 1, 2)),
ADD COLUMN created_at timestamp DEFAULT current_timestamp,
ADD COLUMN created_by integer,
ADD COLUMN updated_at timestamp,
ADD COLUMN updated_by integer,
ADD COLUMN deleted_at timestamp,
ADD COLUMN deleted_by integer;

ALTER TABLE productos
ADD CONSTRAINT fk_producto_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_producto_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_producto_deleted_by FOREIGN KEY (deleted_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;



INSERT INTO tallas (nombre_talla) VALUES
('6'),('8'),('10'),('12'),('14'),('16'),
('XS'),('S'),('M'),('L'),('XL'),('XXL');

INSERT INTO tipos_uniforme (nombre_tipo) VALUES
('Inicial'),
('Primaria'),
('Secundaria');

ALTER TABLE variantes_producto
ADD COLUMN id_tipo integer,
ADD CONSTRAINT fk_variante_tipo
FOREIGN KEY (id_tipo) REFERENCES tipos_uniforme(id_tipo);


INSERT INTO productos (nombre_producto, descripcion, precio, id_categoria, genero, estado, created_by) VALUES
('Polo de Educación Física',  'Polo deportivo escolar de algodón piqué',      25.00,  1, 'unisex',    1, 1),
('Camisa Manga Larga Hombre', 'Camisa formal escolar blanca manga larga',      35.00,  2, 'masculino', 1, 1),
('Camisa Manga Corta Hombre', 'Camisa formal escolar blanca manga corta',      30.00,  2, 'masculino', 1, 1),
('Blusa Manga Larga',         'Blusa formal escolar blanca manga larga',       33.00,  3, 'femenino',  1, 1),
('Blusa Manga Corta',         'Blusa formal escolar blanca manga corta',       28.00,  3, 'femenino',  1, 1),
('Pantalón Escolar Hombre',   'Pantalón formal gris escolar para niño',        45.00,  4, 'masculino', 1, 1),
('Falda Escolar',             'Falda escolar tela fría cuadros o lisa',        40.00,  5, 'femenino',  1, 1),
('Short Deportivo',           'Short de educación física escolar',             28.00,  6, 'unisex',    1, 1),
('Pantalón de Buzo',          'Pantalón de buzo escolar educación física',     42.00,  7, 'unisex',    1, 1),
('Chompa Escolar Cuello V',   'Chompa escolar cuello en V de lana acrílica',   55.00,  8, 'unisex',    1, 1),
('Chompa Escolar Redonda',    'Chompa escolar cuello redondo lana acrílica',   52.00,  8, 'unisex',    1, 1),
('Corbata Escolar',           'Corbata escolar personalizada por colegio',     15.00, 10, 'unisex',    1, 1),
('Cinturón Escolar',          'Cinturón escolar de cuero sintético negro',     12.00, 10, 'unisex',    1, 1);

ALTER TABLE productos ADD CONSTRAINT uq_nombre_producto UNIQUE (nombre_producto);

DELETE FROM productos WHERE id_producto = 15;

ALTER TABLE productos ADD CONSTRAINT uq_nombre_producto UNIQUE (nombre_producto);


ALTER TABLE productos
RENAME COLUMN precio TO precio_costo;

ALTER TABLE productos
ADD COLUMN precio_venta numeric(10,2) NOT NULL DEFAULT 0.00;

UPDATE productos SET precio_venta = precio_costo * 1.30 WHERE estado = 1;

CREATE UNIQUE INDEX uq_categorias_nombre 
ON categorias (LOWER(nombre));

ALTER TABLE usuarios
ADD CONSTRAINT uq_usuario_nombre UNIQUE (nombre);


// 18 de mayo
CREATE TYPE estado_venta AS ENUM ('pendiente', 'pagada', 'anulada');

CREATE TABLE ventas (
    id_venta SERIAL PRIMARY KEY,
    numero_venta VARCHAR(20) UNIQUE,
    id_pedido INTEGER NOT NULL UNIQUE,
    id_cliente INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_documento VARCHAR(20) DEFAULT 'nota_venta',
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    descuento NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    estado estado_venta DEFAULT 'pendiente',
    observaciones VARCHAR(255),
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE detalle_venta (
    id_detalle_venta SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    id_variante INTEGER,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL,
    descuento NUMERIC(10,2) DEFAULT 0.00,
    subtotal NUMERIC(10,2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
    FOREIGN KEY (id_variante) REFERENCES variantes_producto(id_variante)
);

///
ALTER TABLE usuarios
ADD COLUMN created_by INTEGER,
ADD COLUMN updated_at TIMESTAMP,
ADD COLUMN updated_by INTEGER,
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN deleted_by INTEGER;

ALTER TABLE usuarios
ADD CONSTRAINT fk_usuario_created_by
    FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_usuario_updated_by
    FOREIGN KEY (updated_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_usuario_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
//22-05-2026
INSERT INTO colegios (nombre_colegio, distrito, provincia) VALUES
('San José',          'Chiclayo', 'Chiclayo'),
('Fe y Alegría N28',  'Chiclayo', 'Chiclayo'),
('Santa María Reina', 'Chiclayo', 'Chiclayo');


INSERT INTO colegios (nombre_colegio, distrito, provincia) VALUES
('San José',          'Chiclayo', 'Chiclayo'),
('Fe y Alegría N28',  'Chiclayo', 'Chiclayo'),
('Santa María Reina', 'Chiclayo', 'Chiclayo');


INSERT INTO productos
(nombre_producto, descripcion, precio_costo, precio_venta,
 id_categoria, genero, id_colegio, estado, created_by)
VALUES



('Polo EF San José',
 'Polo educación física  v/blanco San José',
 22.00, 30.00, 1, 'masculino', 1, 1, 1),

('Camisa San José',
 'Camisa blanca escolar manga corta San José',
 28.00, 38.00, 2, 'masculino', 1, 1, 1),

('Pantalón San José',
 'Pantalón escolar negro San José',
 38.00, 50.00, 4, 'masculino', 1, 1, 1),

('Casaca San José',
 'Casaca deportiva vino - San José',
 45.00, 60.00, 6, 'masculino', 1, 1, 1),

('Buzo San José',
 'Buzo deportivo vino - San José',
 40.00, 55.00, 7, 'masculino', 1, 1, 1),

('Chompa San José',
 'Chompa escolar vino - San José',
 42.00, 58.00, 8, 'masculino', 1, 1, 1),

('Corbata Roja San José',
 'Corbata roja escolar San José',
 12.00, 18.00, 9, 'masculino', 1, 1, 1),


('Polo EF Fe y Alegría',
 'Polo educación física rojo/blanco Fe y Alegría',
 22.00, 30.00, 1, 'unisex', 2, 1, 1),

('Casaca Fe y Alegría',
 'Casaca deportiva Fe y Alegría',
 45.00, 60.00, 6, 'unisex', 2, 1, 1),

('Buzo Fe y Alegría',
 'Buzo deportivo Fe y Alegría',
 40.00, 55.00, 7, 'unisex', 2, 1, 1),

('Camisa Fe y Alegría',
 'Camisa blanca escolar Fe y Alegría',
 28.00, 38.00, 2, 'masculino', 2, 1, 1),

('Blusa Fe y Alegría',
 'Blusa blanca escolar Fe y Alegría',
 26.00, 35.00, 3, 'femenino', 2, 1, 1),

('Pantalón Fe y Alegría',
 'Pantalón escolar gris Fe y Alegría',
 38.00, 50.00, 4, 'masculino', 2, 1, 1),

('Falda Fe y Alegría',
 'Falda escolar gris Fe y Alegría',
 35.00, 47.00, 5, 'femenino', 2, 1, 1),

('Polo EF Santa María',
 'Polo educación física verde/blanco Santa María Reina',
 22.00, 30.00, 1, 'femenino', 3, 1, 1),

('Blusa Santa María',
 'Blusa blanca escolar Santa María Reina',
 25.00, 34.00, 3, 'femenino', 3, 1, 1),

('Falda Santa María',
 'Falda escolar cuadros celeste Santa María Reina',
 35.00, 47.00, 5, 'femenino', 3, 1, 1),

('Casaca Santa María',
 'Casaca deportiva Santa María Reina',
 45.00, 60.00, 6, 'femenino', 3, 1, 1),

('Buzo Santa María',
 'Buzo deportivo Santa María Reina',
 40.00, 55.00, 7, 'femenino', 3, 1, 1),

('Chompa Santa María',
 'Chompa escolar Santa María Reina',
 42.00, 58.00, 8, 'femenino', 3, 1, 1);

select * from perfiles;
select * from usuarios;
select *from clientes;
select * from opciones;
select *from categorias;
select *from productos;
select *from tipos_uniforme;
select *from variantes_producto;
SELECT * FROM variantes_producto LIMIT 5;
select *from colegios;


SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT * FROM metodos_pago_empresa;

// 29-05-26
ALTER TYPE tipo_comprobante ADD VALUE 'visa';

INSERT INTO metodos_pago_empresa (tipo, nombre_titular, numero_cuenta, numero_telefono, activo) VALUES
('yape',          'Confecciones Lix', NULL,               '945952450', true),
('plin',          'Confecciones Lix', NULL,               '945952450', true),
('transferencia', 'Confecciones Lix', '30598113774008', NULL,       true),
('visa',          'Confecciones Lix', NULL,               NULL,        true);

SELECT unnest(enum_range(NULL::tipo_comprobante));

ALTER TYPE tipo_comprobante;
ADD VALUE 'visa';
//31-05-26

select * from clientes

ALTER TABLE clientes
ADD COLUMN dni VARCHAR(15),
ADD COLUMN estado SMALLINT NOT NULL DEFAULT 1
    CONSTRAINT chk_estado_cliente CHECK (estado IN (0, 1, 2)),
ADD COLUMN created_by INTEGER,
ADD COLUMN updated_at TIMESTAMP,
ADD COLUMN updated_by INTEGER,
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN deleted_by INTEGER;

ALTER TABLE clientes
ADD CONSTRAINT fk_cliente_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_cliente_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
ADD CONSTRAINT fk_cliente_deleted_by FOREIGN KEY (deleted_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

CREATE SEQUENCE public.sliders_id_slider_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.sliders
(
    id_slider integer NOT NULL DEFAULT nextval('sliders_id_slider_seq'::regclass),
    imagen_url text NOT NULL,
    nombre_archivo character varying(150),
    titulo character varying(150),
    orden integer DEFAULT 0,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sliders_pkey PRIMARY KEY (id_slider)
);

ALTER SEQUENCE public.sliders_id_slider_seq
    OWNED BY public.sliders.id_slider;

CREATE SEQUENCE public.recursos_tienda_id_recurso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.recursos_tienda
(
    id_recurso integer NOT NULL DEFAULT nextval('recursos_tienda_id_recurso_seq'::regclass),
    tipo character varying(50) NOT NULL,
    nombre_archivo character varying(150),
    url text NOT NULL,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recursos_tienda_pkey PRIMARY KEY (id_recurso)
);

ALTER SEQUENCE public.recursos_tienda_id_recurso_seq
    OWNED BY public.recursos_tienda.id_recurso;

CREATE SEQUENCE public.configuracion_sistema_id_config_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.configuracion_sistema
(
    id_config integer NOT NULL DEFAULT nextval('configuracion_sistema_id_config_seq'::regclass),
    nombre_tienda character varying(100),
    moneda character varying(5) DEFAULT 'PEN',
    costo_delivery numeric(10,2) DEFAULT 0.00,
    whatsapp character varying(20),
    correo_contacto character varying(100),
    actualizado_en timestamp w	ithout time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT configuracion_sistema_pkey PRIMARY KEY (id_config)
);

ALTER SEQUENCE public.configuracion_sistema_id_config_seq
    OWNED BY public.configuracion_sistema.id_config;

-- 02-06-2026: Actualizaciones del módulo de Inventario
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 10;

ALTER TABLE movimiento_stock 
ADD COLUMN IF NOT EXISTS stock_antes INTEGER,
ADD COLUMN IF NOT EXISTS stock_despues INTEGER,
ADD COLUMN IF NOT EXISTS boleta VARCHAR(60),
ADD COLUMN IF NOT EXISTS observacion VARCHAR(200);

-- Insertar variantes de prueba si no existen
INSERT INTO variantes_producto (id_producto, id_talla, color, stock, precio_extra, id_tipo)
SELECT p.id_producto, t.id_talla, 'Blanco', 15, 0.00, 2
FROM productos p
CROSS JOIN tallas t
WHERE p.nombre_producto = 'Polo EF San José' AND t.nombre_talla IN ('M', 'L')
ON CONFLICT (id_producto, id_talla, color) DO NOTHING;

INSERT INTO variantes_producto (id_producto, id_talla, color, stock, precio_extra, id_tipo)
SELECT p.id_producto, t.id_talla, 'Gris', 8, 0.00, 3
FROM productos p
CROSS JOIN tallas t
WHERE p.nombre_producto = 'Pantalón San José' AND t.nombre_talla IN ('30', '32', 'M', 'L')
ON CONFLICT (id_producto, id_talla, color) DO NOTHING;

INSERT INTO variantes_producto (id_producto, id_talla, color, stock, precio_extra, id_tipo)
SELECT p.id_producto, t.id_talla, 'Blanco', 20, 0.00, 2
FROM productos p
CROSS JOIN tallas t
WHERE p.nombre_producto = 'Camisa Fe y Alegría' AND t.nombre_talla IN ('S', 'M')
ON CONFLICT (id_producto, id_talla, color) DO NOTHING;

