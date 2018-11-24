/* jshint esnext: true */
var config = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/user-msqp/config/config.js');
var email = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/user-msqp/lib/email_lib.js');


/**
 *  Setup the pool of connections to the db so that every connection can be reused upon it's release
 *
 */
var mysql = require('mysql');
var Sequelize = require('sequelize');
const sequelize = new Sequelize(config.db.name, config.db.user_name, config.db.password, {
    host: config.db.host,
    dialect: config.db.dialect,
    port: config.db.port,
    operatorsAliases: config.db.operatorsAliases,
    pool: {
      max: config.db.pool.max,
      min: config.db.pool.min,
      acquire: config.db.pool.acquire,
      idle: config.db.pool.idle
    }
});

/**
 *  Publishes message on api-user-c topic
 */
function publishOnUserC(amqpConn, message, topic) {
    if (amqpConn !== null) {
        amqpConn.createChannel(function(err, ch) {
            var exchange = 'apiUserC.*';
            var toipcName = `apiUserC.${topic}`;
            ch.assertExchange(exchange, 'topic', { durable: true });
            ch.publish(exchange, toipcName, new Buffer(message));
        });
    }else {
        // log and send error
        email.sendApiUserMSQPErrorEmail("User MSQP AMPQ connection was empty");
    }
}

/**
 *  Creates new user
 *
 * (user Object): user object that holds all the user data
 * (amqpConn Object): rabbitmq connection object that is used to connect and publish and consume 
 */
module.exports.createUser = function (user, amqpConn) {
    sequelize.query('CALL SaveNewUser(?,?,?,?,?,?,?,?)',
    { replacements: [ user.userId, user.userName, user.profilePic, user.statusMessage, user.userProfileCreated, user.userProfileLastUpdated, user.contactIds, user.dateCreated ],
            type: sequelize.QueryTypes.RAW }).then(result => {
                console.log(result);
                var response = {
                    status: config.rabbitmq.statuses.ok,
                    userId: user.userId
                };
                publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.newUserProcessedMSQP);
    }).error(function(err){
        email.sendApiUserMSQPErrorEmail(err);
        var response = {
            status: config.rabbitmq.statuses.error,
            userId: user.userId
        };
        publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.newUserProcessedMSQP);
    });
};

/**
 *  Updates user profile picture url and status message
 *
 * (userId String): id of the user who's data is to be updated
 * (amqpConn Object): RabbitMQ connection object that is used to send api-user-c response
 */
module.exports.updateStatusAndProfilePic = function (message, amqpConn){
    console.log("updateUser has been called");
    // update statusMessage and profile pic for user with id
    sequelize.query('CALL UpdateUserStatusAndProfilePicture(?,?,?)',
        { replacements: [ message.userId, message.statusMessage, message.profilePicUrl ],
            type: sequelize.QueryTypes.RAW }).then(result => {
                // send success message via mq
                var response = {
                    status: config.rabbitmq.statuses.ok,
                    userId: message.userId
                };
                publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userUpdateProfile);
    }).error(function(err){
        email.sendApiUserMSQPErrorEmail(err);
        // send error message via mq
        var response = {
            status: config.rabbitmq.statuses.error,
            userId: message.userId
        };
        publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userUpdateProfile);
    });
};

/**
 *  Updates user is allowed to unsend
 *
 * (userId int): id of the user of who is allowing their contact to unsend messages
 * (contactId int): id of the contact to whom the user is allowing to unsend messages
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.updateUserIsAllowedToUnsend = function (message, amqpConn){
    sequelize.query('CALL UpdateContactIsAllowedToUnsend(?,?)',
    { replacements: [ message.userId, message.contactId ],
         type: sequelize.QueryTypes.RAW }).then(result => {
            // send success message via mq
            var response = {
                status: config.rabbitmq.statuses.ok,
                userId: message.userId
            };
            publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userAllowUnsendMSQP);
    }).error(function(err){
        email.sendApiUserMSQPErrorEmail(err);
        // send error message via mq
        var response = {
            status: config.rabbitmq.statuses.error,
            userId: message.userId
        };
        publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userAllowUnsendMSQP);
    });
};


/**
 *  Updates user is not allowed to unsend
 *
 * (userId int): id of the user of who is not allowing their contact to unsend messages
 * (contactId int): id of the contact to whom the user is not allowing to unsend messages
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.updateUserIsNotAllowedToUnsend = function (message, amqpConn){
    sequelize.query('CALL UpdateContactIsNotAllowedToUnsend(?,?)',
    { replacements: [ message.userId, message.contactId ],
         type: sequelize.QueryTypes.RAW }).then(result => {
             // send success message via mq
             var response = {
                status: config.rabbitmq.statuses.ok,
                userId: message.userId
            };
            publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userDisAllowUnsendMSQP);
    }).error(function(err){
        email.sendApiUserMSQPErrorEmail(err);
        // send error message via mq
        var response = {
            status: config.rabbitmq.statuses.error,
            userId: message.userId
        };
        publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userDisAllowUnsendMSQP);
    });
};


module.exports.checkIfUserIsAllowedToUnsend = function (req, res){
    console.log(JSON.stringify(req.body));
    sequelize.query('CALL CheckIfUserIsAllowedToUnsend(?,?)',
    { replacements: [ req.body.senderId, req.body.contactId ],
        type: sequelize.QueryTypes.RAW }).then(result => {
            res.json(result[0].contact_is_allowed_to_unsend);
    }).error(function(err){
        email.sendApiUserMSQPErrorEmail(err);
        // send error message via mq
        var response = {
            status: config.rabbitmq.statuses.error,
            userId: message.userId
        };
        publishOnUserC(amqpConn, JSON.stringify(response), config.rabbitmq.topics.userDisAllowUnsendMSQP);
    });
};