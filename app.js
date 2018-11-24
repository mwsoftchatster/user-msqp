/* jshint esnext: true */
require('events').EventEmitter.prototype._maxListeners = 0;
var config = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/user-msqp/config/config.js');
var email = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/user-msqp/lib/email_lib.js');
var functions = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/user-msqp/lib/func_lib.js');
var fs = require("fs");
var amqp = require('amqplib/callback_api');
var express = require("express");
var http = require('http');
var app = express();
var bodyParser = require("body-parser");
var cors = require("cors");
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.raw({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(express.static("./public"));
app.use(cors());

app.use(function(req, res, next) {
    next();
});

var server = http.createServer(null, app).listen(config.port.user_msqp_port, function() {
    email.sendNewUserMSQPIsUpEmail();
});

/**
 *   RabbitMQ connection object
 */
var amqpConn = null;

/**
 *  Subscribe user-msqp to topic to receive messages
 */
function subscribeToUserMSQP(topic) {
    if (amqpConn !== null) {
        amqpConn.createChannel(function(err, ch) {
            var exchange = 'userMSQP.*';
            var toipcName = `userMSQP.${topic}`;
            ch.assertExchange(exchange, 'topic', { durable: true });
            ch.assertQueue(toipcName, { exclusive: false, auto_delete: true }, function(err, q) {
                ch.bindQueue(q.queue, exchange, toipcName);
                ch.consume(q.queue, function(msg) {
                    var message = JSON.parse(msg.content.toString());
                    if (toipcName === `userMSQP.${config.rabbitmq.topics.newUser}`){
                        functions.createUser(message, amqpConn);
                    } else if (toipcName === `userMSQP.${config.rabbitmq.topics.userUpdateProfile}`){
                        functions.updateStatusAndProfilePic(message, amqpConn);
                    } else if (toipcName === `userMSQP.${config.rabbitmq.topics.userAllowUnsend}`){
                        functions.updateUserIsAllowedToUnsend(message, amqpConn);
                    } else if (toipcName === `userMSQP.${config.rabbitmq.topics.userDisAllowUnsend}`){
                        functions.updateUserIsNotAllowedToUnsend(message, amqpConn);
                    }
                }, { noAck: true });
            });
        });
    }
}

/**
 *  Connect to RabbitMQ
 */
function connectToRabbitMQ() {
    amqp.connect(config.rabbitmq.url, function(err, conn) {
        if (err) {
            console.error("[AMQP]", err.message);
            return setTimeout(connectToRabbitMQ, 1000);
        }
        conn.on("error", function(err) {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", err.message);
            }
        });
        conn.on("close", function() {
            console.error("[AMQP] reconnecting");
            return setTimeout(connectToRabbitMQ, 1000);
        });
        console.log("[AMQP] connected");
        email.sendNewUserMSQPIsUpEmail();
        amqpConn = conn;

        // Subscribe to topics
        subscribeToUserMSQP(config.rabbitmq.topics.newUser);
        subscribeToUserMSQP(config.rabbitmq.topics.userUpdateProfile);
        subscribeToUserMSQP(config.rabbitmq.topics.userAllowUnsend);
        subscribeToUserMSQP(config.rabbitmq.topics.userDisAllowUnsend);
    });
}

connectToRabbitMQ();


/**
 *  POST checkIfUserIsAllowedToUnsend request
 * 
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
app.post("/checkIfUserIsAllowedToUnsend", function(req, res) {
    console.log("/checkIfUserIsAllowedToUnsend has been called");
    functions.checkIfUserIsAllowedToUnsend(req, res);
});