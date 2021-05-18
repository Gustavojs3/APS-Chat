//Arquivos e variáveis necessários
const express = require('express'); //Faz a tratativa de um arquivo estático - rota
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
const server = require('http').createServer(app); //Define o protocolo http
const io = require('socket.io')(server); //Define o protocolo wss do web socket

const session = require('express-session');
const flash = require('connect-flash');

const jwt = require('jsonwebtoken'); //Token
const SECRET = 'chaveToken123@';

var today = new Date();
var hora = today.getHours() + ':' + (today.getMinutes() < 10 ? '0' : '') + today.getMinutes();

const db = require('./db'); //Chama meu arquivo de conexão ao banco

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'views/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '_' + file.originalname);
    }
});
const upload = multer({ storage });

//Configurações
app.use(session({
    secret: "chaveSession123@",
    resave: true,
    saveUninitialized: true
}));
app.use(flash());

app.use(express.static(path.join(__dirname, 'views'))); //Pasta onde vai ficar os arquivos front-end
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(express.json());
app.use(express.urlencoded());

//Index
app.get('/', (req, res) => {
    res.render('index');
});
//Chat
app.get('/chat/:token', (req, res) => {
    //console.log(req.params.token);
    res.render('chat');
});
//Login
app.post('/login', async (req, res) => {
    const rs = await db.selectUsuario(req.body.login, req.body.senha);

    if (rs.length) {
        const token = jwt.sign({ usuario_id: rs[0].id }, SECRET, { expiresIn: 600 });

        db.updateUsuarioSocket(rs[0].id, token);

        return res.redirect('/chat/' + token);
    } else {
        console.log('Usuário não encontrado!');
    }

    return res.redirect('/');
});
//Cadastro
app.post('/cadastro', async (req, res) => {
    const rs = await db.selectVerificaLogin(req.body.login);

    if (!rs.length) {
        const token = jwt.sign({ usuario_id: 0 }, SECRET, { expiresIn: 600 });

        db.insertUsuario(req.body.nome, req.body.login, req.body.email, req.body.senha, token);

        return res.redirect('/chat/' + token);
    } else {
        console.log('Usuário com as mesmas credenciais!');
    }

    return res.redirect('/');
});
//Upload
app.post('/upload', upload.single("arquivo"), (req, res) => {
    var data = JSON.parse(req.body.data_usaurio);
    data['usuario_destiono'] = null;
    data['hora'] = hora;
    data['mensagem'] = '';
    data['arquivo'] = req.file.filename;

    //db.insertChat(data);

    res.send(data);
});

//Retorna as mensagens
async function historicoMensagens(socket, filtro = {}) {
    const rs = await db.selectChat(filtro);
    socket.emit('historicoMensagens', rs);
}

//Evento que detecta uma novo cliente - novo socket
io.on('connection', socket => {
    console.log(`Socket conectado: ${socket.id}`);

    //Coloca o usuário na sala "Geral"
    var sala = 'geral';
    var tipo = 'grupo';
    socket.join('geral');

    //Valida usuário
    socket.on('validaAcesso', async data => {
        var [rs] = await db.validaUsuario(data);

        if (rs) {
            socket.emit('validaAcesso', { usuario_id: rs.id, usuario: rs.nome, sala: sala, tipo: tipo });

            //Histórico de mensagens
            historicoMensagens(socket, { tipo: tipo, sala: sala, ativo: 1 });
        } else {
            socket.emit('validaAcesso', false);
        }
    });

    //Envia mensagens
    socket.on('enviaMensagem', data => {
        if (data.sala) {
            tipo = 'grupo';

            switch (data.sala) {
                case 'geral':
                    socket.to('geral').emit('recebeMensagem', data);
                    db.insertChat(data);
                    break;
                case 'jogos':
                    socket.to('jogos').emit('recebeMensagem', data);
                    db.insertChat(data);
                    break;
                case 'filmes':
                    socket.to('filmes').emit('recebeMensagem', data);
                    db.insertChat(data);
                    break;
                default:
                    socket.broadcast.emit('recebeMensagem', data);
                    db.insertChat(data);
                    break;
            }
        }
    });

    //Mudar de sala
    socket.on('mudarSala', data => {
        socket.leave(sala); //Sai da sala

        switch (data.sala) {
            case 'geral':
                socket.join('geral');
                sala = 'geral';
                break;
            case 'jogos':
                socket.join('jogos');
                sala = 'jogos';
                break;
            case 'filmes':
                socket.join('filmes');
                sala = 'filmes';
                break;
            default:
                socket.join('geral');
                sala = 'geral';
                break;
        }

        //Trás o histórico de mensagens da sala
        historicoMensagens(socket, { tipo: tipo, sala: sala, ativo: 1 });
    });
});

//Servidor 
server.listen(3000, function () {
    console.log('Conexão OK!');
});