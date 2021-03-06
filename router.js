"use strict";

const UsersModel = require('./models/users.model');
const MessageModel = require('./models/messages.model');
const _ = require('lodash');
const config = require('./config');
const bcrypt = require('bcryptjs');
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const io = require('socket.io');

function checkAuth (req, res, next) {
    passport.authenticate('jwt', { session: false }, (err, decryptToken, jwtError) => {
        if(jwtError != void(0) || err != void(0)) return res.render('index', { error: err || jwtError});
        req.user = decryptToken;
        console.log(req.user);
        console.log(req.user.username);
        next();
    })(req, res, next);
}

function auth2 (socket, next) {

    // Parse cookie
    cookieParser()(socket.request, socket.request.res, () => {});

    // JWT authenticate
    passport.authenticate('jwt', {session: true}, function (error, decryptToken, jwtError) {
        if(!error && !jwtError && decryptToken) {
            next(false, {username: decryptToken.username, id: decryptToken.id});
        } else {
            next('guest');
        }
    })
    (socket.request, socket.request.res);

}

function createToken (body) {
    return jwt.sign(
        body,
        config.jwt.secretOrKey,
        {expiresIn: config.expiresIn}
    );
}

module.exports = app => {
    // app.use('/assets', express.static('./client/public'));

    app.get('/', (req, res) => {
        res.render('index.ejs');
    });

    app.get('/login', (req, res) => {
        res.render('login.ejs')
    });


    app.post('/changename', checkAuth, (req, res) => {
        console.log(req.user);
        UsersModel.update({username: req.user.username}, { $set: {username: req.body.newname}}, function (err, user) {
            if (err) return handleError(err);
            res.send("Succes!");
        });
    });


    app.get('/profile', (req, res) => {
        res.render('profile.ejs')
    });



    app.get('/api/getalluser', async (req, res) => {
        let users = await UsersModel.find().lean().exec();
        res.send(users);
        }
    );

    app.get('/api/getallmsg', async (req, res) => {
        let messages = await MessageModel.find().lean().exec();
        res.send(messages);
    })

    app.post('/login', async (req, res) => {
        try {
            let user = await UsersModel.findOne({email: {$regex: _.escapeRegExp(req.body.email), $options: "i"}}).lean().exec();
            if(user != void(0) && bcrypt.compareSync(req.body.password, user.password)) {
                const token = createToken({id: user._id, username: user.username});
                res.cookie('token', token, {
                    httpOnly: true
                });

                res.status(200).send({message: "User login success."});
            } else res.status(400).send({message: "User not exist or password not correct"});
        } catch (e) {
            console.error("E, login,", e);
            res.status(500).send({message: "some error"});
        }
    });

    app.post('/register', async (req, res) => {
        try {
            let user = await UsersModel.findOne({username: {$regex: _.escapeRegExp(req.body.username), $options: "i"}}).lean().exec();
            if(user != void(0)) return res.status(400).send({message: "User already exist"});

            user = await UsersModel.create({
                email: req.body.email,
                username: req.body.username,
                password: req.body.password
            });

            const token = createToken({id: user._id, username: user.username});

            res.cookie('token', token, {
                httpOnly: true
            });

            res.status(200).send({message: "User created."});

        } catch (e) {
            console.error("E, register,", e);
            res.status(500).send({message: "some error"});
        }
    });

    app.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.status(200).send({message: "Logout success."});
    })
};