const express = require('express');
const router = express.Router();
const db = require('../db');

const bcrypt = require('bcryptjs');

// middleware para proteger rutas
function requireLogin(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.redirect('/login');
    }
}

// home - mostrar todos los productos
router.get('/', requireLogin, (req, res) => {
    db.query('select * from productos', (err, productos) => {
        if (err) {
            console.error(err);
            return res.status(500).send('error al obtener productos');
        }
        res.render('home', { productos });
    });
});

// formulario para agregar producto
router.get('/agregar', (req, res) => {
    res.render('agregar');
});

// guardar producto nuevo
router.post('/agregar', requireLogin, (req, res) => {
    const { nombre, precio, categoria, imagen_url } = req.body;
    const estrellas = req.body.estrellas || 5.0;
    const img = imagen_url || '/img/default.jpg';
    db.query(
        'insert into productos (nombre, precio, categoria, imagen_url, estrellas) values (?, ?, ?, ?, ?)',
        [nombre, precio, categoria, img, estrellas],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('error al guardar producto');
            }
            res.redirect('/');
        }
    );
});

// mostrar login
router.get('/login', (req, res) => {
    res.render('login', { layout: 'login-layout' });
});

// procesar login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query('select * from usuarios where email = ?', [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.render('login', { layout: 'login-layout', error: 'Correo o contraseña incorrectos' });
        }
        const usuario = results[0];
        const match = await bcrypt.compare(password, usuario.password);
        if (!match) {
            return res.render('login', { layout: 'login-layout', error: 'Correo o contraseña incorrectos' });
        }
        req.session.usuario = usuario;
        res.redirect('/');
    });
});

// mostrar registro
router.get('/registro', (req, res) => {
    res.render('registro', { layout: 'login-layout' });
});

// procesar registro
router.post('/registro', async (req, res) => {
    const { nombre, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.query(
        'insert into usuarios (nombre, email, password) values (?, ?, ?)',
        [nombre, email, hash],
        (err) => {
            if (err) {
                return res.render('registro', { layout: 'login-layout', error: 'El correo ya está registrado' });
            }
            res.redirect('/login');
        }
    );
});

// cerrar sesion
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// filtrar por categoria
router.get('/categoria/:nombre', requireLogin, (req, res) => {
    const nombre = req.params.nombre;
    db.query('select * from productos where categoria = ?', [nombre], (err, productos) => {
        if (err) {
            console.error(err);
            return res.status(500).send('error al obtener productos');
        }
        res.render('categoria', { productos, categoriaActual: nombre });
    });

    // agregar al carrito
    router.post('/carrito/agregar', requireLogin, (req, res) => {
        const { id, nombre, precio, imagen_url } = req.body;
        if (!req.session.carrito) {
            req.session.carrito = [];
        }
        const productoExistente = req.session.carrito.find(p => p.id == id);
        if (productoExistente) {
            productoExistente.cantidad++;
        } else {
            req.session.carrito.push({ id, nombre, precio: parseFloat(precio), imagen_url, cantidad: 1 });
        }
        res.redirect('/carrito');
    });

    // ver carrito
    router.get('/carrito', requireLogin, (req, res) => {
        const carrito = req.session.carrito || [];
        const total = carrito.reduce((sum, p) => sum + p.precio * p.cantidad, 0);
        res.render('carrito', { carrito, total });
    });

    // eliminar del carrito
    router.post('/carrito/eliminar', requireLogin, (req, res) => {
        const { id } = req.body;
        req.session.carrito = req.session.carrito.filter(p => p.id != id);
        res.redirect('/carrito');
    });

    // vaciar carrito
    router.post('/carrito/vaciar', requireLogin, (req, res) => {
        req.session.carrito = [];
        res.redirect('/carrito');


    });


    // aumentar cantidad
    router.post('/carrito/aumentar', requireLogin, (req, res) => {
        const { id } = req.body;
        const producto = req.session.carrito.find(p => p.id == id);
        if (producto) producto.cantidad++;
        res.redirect('/carrito');
    });

    // reducir cantidad
    router.post('/carrito/reducir', requireLogin, (req, res) => {
        const { id } = req.body;
        const producto = req.session.carrito.find(p => p.id == id);
        if (producto && producto.cantidad > 1) {
            producto.cantidad--;
        } else {
            req.session.carrito = req.session.carrito.filter(p => p.id != id);
        }
        res.redirect('/carrito');
    });

});

// pagar
router.post('/pagar', requireLogin, (req, res) => {
    const carrito = req.session.carrito || [];
    const total = carrito.reduce((sum, p) => sum + p.precio * p.cantidad, 0);
    const usuarioId = req.session.usuario.id;

    db.query('insert into ordenes (usuario_id, total) values (?, ?)', [usuarioId, total], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('error al guardar la orden');
        }
        const ordenId = result.insertId;
        const productos = carrito.map(p => [ordenId, p.id, p.nombre, p.precio, p.cantidad]);

        db.query('insert into orden_productos (orden_id, producto_id, nombre, precio, cantidad) values ?', [productos], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('error al guardar productos de la orden');
            }
            const carritoConSubtotal = carrito.map(p => ({
                ...p,
                subtotal: p.precio * p.cantidad
            }));
            req.session.carrito = [];
            res.render('confirmacion', { carrito: carritoConSubtotal, total });
        });
    });
});

module.exports = router;