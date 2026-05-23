require('dotenv').config();
const session = require('express-session');
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');

const productosRoutes = require('./routes/productos');

const app = express();
const PORT = process.env.PORT || 3000;

// motor de vistas
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'index',
    layoutsDir: path.join(__dirname, 'views/layout'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// sesion
app.use(session({
    secret: 'oxigen-secret-key',
    resave: false,
    saveUninitialized: false
}));

// rutas
app.use('/', productosRoutes);

// middleware de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('algo salió mal 😥');
});

app.listen(PORT, () => {
    console.log(`servidor corriendo en http://localhost:${PORT}`);
});