let express = require('express');
let morgan = require('morgan');
let cluster = require('cluster');
let numCPUs = require('os').cpus().length;
let bodyParser = require('body-parser');
let port = require('./config/port');
let logger = require('./config/logger');
let dateformat = require('dateformat');
let fs = require('fs');
const csv = require('csv-parser')

let loginRouter = require('./routes/login');
let mainRouter = require('./routes/main');
let feedRouter = require('./routes/feed');
let searchRouter = require('./routes/search');
let productRouter = require('./routes/product');
let forumRouter = require('./routes/forum');
let userRouter = require('./routes/user');
let cartRouter = require('./routes/cart');
let managerRouter = require('./routes/manager');
let notificationRouter = require('./routes/notification');


let app = express();


app.use(morgan('combined', { stream: logger.stream }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit:5000000}));


app.use('/api/login', loginRouter);
app.use('/api/main', mainRouter);
app.use('/api/feed', feedRouter);
app.use('/api/search', searchRouter);
app.use('/api/product', productRouter);
app.use('/api/forum', forumRouter);
app.use('/api/user', userRouter);
app.use('/api/cart', cartRouter);
app.use('/api/notification', notificationRouter);
app.use('/api/manager', managerRouter);

let database = require('./database');

let mongoConnect = function() {

    database.connect( () => {
        app.listen(port.number);
        logger.log( 'info','MONGODB CONNECTED');
        logger.log('info', 'Server started on', {date:  dateformat(new Date)});
        logger.log('info', 'Port', {port: port.number});

    })
};

if(cluster.isMaster){
  for(let i = 0; i < numCPUs; i++){
    cluster.fork();
  }
}else{
    mongoConnect();
}

module.exports = app;
