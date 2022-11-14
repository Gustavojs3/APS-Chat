/****************** Conexão *********************/
async function connect() {
    //Caso já tenha uma conexão "aberta" ela é retornada
    if (global.connection && global.connection.state !== 'disconnected') {
        return global.connection;
    } else {
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection('mysql://root@localhost:3306/aps_chat');
        global.connection = connection;
        console.log('Conectado ao BD - APS Chat!');
        return connection;
    }
}

/****************** Chat *********************/
async function selectChat(filtro = {}) {
    const conn = await connect();

    var filtro_sql = '';
    var values = [];

    if (filtro) {
        filtro_sql = 'WHERE 1=1';
        if (filtro.id) {
            filtro_sql += ' AND c.id=?';
            values.push(filtro.id);
        } if (filtro.tipo) {
            filtro_sql += ' AND c.tipo=?';
            values.push(filtro.tipo);
        } if (filtro.sala) {
            filtro_sql += ' AND c.sala=?';
            values.push(filtro.sala);
        } if (filtro.ativo) {
            filtro_sql += ' AND c.ativo=?';
            values.push(filtro.ativo);
        }
        filtro_sql += ' AND 2=2';
    }

    const sql = 'SELECT c.*, u.nome as usuario FROM chat as c INNER JOIN usuario as u ON u.id=c.usuario_id AND u.ativo=1 ' + filtro_sql + ' order by c.cad;';
    const [rows] = await conn.query(sql, values);

    return rows;
}

async function insertChat(data) {
    const conn = await connect();
    const sql = 'INSERT INTO chat (usuario_id, usuario_id_destino, tipo, sala, mensagem, arquivo) VALUES (?, ?, ?, ?, ?, ?);';
    const values = [data.usuario_id, data.usuario_id_destino, data.tipo, data.sala, data.mensagem, data.arquivo];
    return await conn.query(sql, values);
}

async function updateChat(id, data) {
    const conn = await connect();
    const sql = 'UPDATE chat SET ativo=? WHERE id=?;';
    const values = [data.ativo, id];
    return await conn.query(sql, values);
}

/****************** Usuário *********************/
async function validaUsuario(socket_id) {
    const conn = await connect();

    const sql = "SELECT id, nome FROM usuario WHERE socket_id=? AND ativo=1;";
    const [rows] = await conn.query(sql, [socket_id]);

    return rows;
}

async function selectUsuario(login, senha) {
    const conn = await connect();

    const sql = "SELECT * FROM usuario WHERE login=? AND senha=? AND ativo=1;";
    const [rows] = await conn.query(sql, [login, senha]);

    return rows;
}

async function selectVerificaLogin(login) {
    const conn = await connect();

    const sql = "SELECT id FROM usuario WHERE login=?;";
    const [rows] = await conn.query(sql, [login]);

    return rows;
}

async function insertUsuario(nome, login, email, senha, socket_id) {
    const conn = await connect();

    const sql = "INSERT INTO usuario (nome,login,email,senha,socket_id) VALUES (?,?,?,?,?);";
    const [rows] = await conn.query(sql, [nome, login, email, senha, socket_id]);

    return rows;
}

async function updateUsuarioSocket(id, socket_id) {
    const conn = await connect();

    const sql = "UPDATE usuario SET socket_id=? WHERE id=?;";
    const [rows] = await conn.query(sql, [socket_id, id]);

    return rows;
}



module.exports = { selectChat, insertChat, updateChat, validaUsuario, selectUsuario, selectVerificaLogin, insertUsuario, updateUsuarioSocket };