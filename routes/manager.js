let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
let bcrypt = require('bcrypt');
let saltRounds = 10;
let secret = require('../config/secret.js');
let Cryptr = require('cryptr');
let cryptr = new Cryptr(secret.key);
let util = require('../util/constants');
let getUid = require('get-uid');
let tracker = require('../config/tracker');
let request = require('request');
let nicepay = require('../config/nicepay');
let querystring = require('querystring');


router.get('/get/seller/exchange/requested/item', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let sellerCollection = db.collection('SELLER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                if(user.isSeller){

                    sellerCollection.aggregate([
                        {$match: {uniqueId: new objectId(uniqueId)}},
                        {
                            $lookup: {
                                from: 'CART',
                                localField: '_id',
                                foreignField: 'seller._id',
                                as: 'cartItem'
                            }
                        },
                        {
                            $unwind: '$cartItem'
                        },
                        {
                            $match: {'cartItem.exchangeStatus' : util.EXCHANGE_STATUS.REQUESTED}
                        },
                        {
                            $lookup: {
                                from: 'ORDER',
                                localField: 'cartItem.orderId',
                                foreignField: '_id',
                                as: 'order'
                            }
                        },
                        {
                            $unwind: '$order'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'order.uniqueId',
                                foreignField: '_id',
                                as:'buyer'
                            }
                        },
                        {
                            $unwind: '$buyer'
                        },
                        {
                            $group: {
                                _id:  '$order._id' ,
                                totalAmount: {$first: '$order.amt'},
                                buyer: {$first:'$buyer'},
                                orderUID: {$first: '$order.orderUID'},
                                //trackingNumber: trackingNumber, shippingCoCode: shippingCoCode, shippingCoName: shippingCoName
                                trackingNumber: {$first: '$order.trackingNumber'},
                                shippingCoCode: {$first: '$order.shippingCoCode'},
                                shippingCoName: {$first: '$order.shippingCoName'},
                                address: {$first: '$order.address'},
                                receiverName: {$first: '$order.receiverName'},
                                phoneNumber:  {$first: '$order.phoneNumber'},
                                zonecode:  {$first: '$order.zonecode'},
                                requestMessage:  {$first: '$order.requestMessage'},
                                cartItem: {$push: '$cartItem'}
                            }
                        }
                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send();
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){

                                throw e2;
                            }

                            let orders = [];

                            docs.forEach(doc => {
                                let obj = {
                                    totalAmount: parseInt(doc.totalAmount),
                                    trackingNumber: doc.trackingNumber,
                                    shippingCoCode: doc.shippingCoCode,
                                    shippingCoName: doc.shippingCoName,
                                    orderId: doc._id,
                                    orderUID: doc.orderUID,
                                    receiverName: doc.receiverName,
                                    phoneNumber: doc.phoneNumber,
                                    address: doc.address,
                                    zonecode: doc.zonecode,
                                    requestMessage: doc.requestMessage,
                                    buyer: {
                                        userId: doc.buyer.userId,
                                        uniqueId: doc.buyer.uniqueId,
                                        userUID: doc.buyer.userUID
                                    },
                                    items: []
                                }

                                doc.cartItem.forEach(item => {
                                    let orderedItem = {
                                        cartId: item._id,
                                        exchangeStatus: item.exchangeStatus,
                                        quantity: item.orderQuantity,
                                        orderStatus: item.orderStatus,
                                        shippingStatus: item.shippingStatus,
                                        option: {
                                            title: item.orderOption.title
                                        },
                                        product: {
                                            title: item.orderProduct.title,
                                            UID: item.orderProduct.productUID,
                                            shippingCost: item.orderProduct.shippingCost
                                        }
                                    }

                                    obj.items.push(orderedItem)
                                })

                                orders.push(obj)

                            });

                            res.json(orders);
                        })
                    })

                }else{
                    res.json([])
                }
            }else{
                res.status(500).send()
            }
        })
})


router.get('/get/seller/refund/requested/item', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let sellerCollection = db.collection('SELLER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                if(user.isSeller){

                    sellerCollection.aggregate([
                        {$match: {uniqueId: new objectId(uniqueId)}},
                        {
                            $lookup: {
                                from: 'CART',
                                localField: '_id',
                                foreignField: 'seller._id',
                                as: 'cartItem'
                            }
                        },
                        {
                            $unwind: '$cartItem'
                        },
                        {
                            $match: {'cartItem.refundStatus' : util.REFUND_STATUS.REQUESTED}
                        },
                        {
                            $lookup: {
                                from: 'ORDER',
                                localField: 'cartItem.orderId',
                                foreignField: '_id',
                                as: 'order'
                            }
                        },
                        {
                            $unwind: '$order'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'order.uniqueId',
                                foreignField: '_id',
                                as:'buyer'
                            }
                        },
                        {
                            $unwind: '$buyer'
                        },
                        {
                            $group: {
                                _id:  '$order._id' ,
                                totalAmount: {$first: '$order.amt'},
                                buyer: {$first:'$buyer'},
                                orderUID: {$first: '$order.orderUID'},
                                //trackingNumber: trackingNumber, shippingCoCode: shippingCoCode, shippingCoName: shippingCoName
                                trackingNumber: {$first: '$order.trackingNumber'},
                                shippingCoCode: {$first: '$order.shippingCoCode'},
                                shippingCoName: {$first: '$order.shippingCoName'},
                                address: {$first: '$order.address'},
                                receiverName: {$first: '$order.receiverName'},
                                phoneNumber:  {$first: '$order.phoneNumber'},
                                zonecode:  {$first: '$order.zonecode'},
                                requestMessage:  {$first: '$order.requestMessage'},
                                cartItem: {$push: '$cartItem'}
                            }
                        }
                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send();
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){

                                throw e2;
                            }

                            let orders = [];

                            docs.forEach(doc => {
                                let obj = {
                                    totalAmount: parseInt(doc.totalAmount),
                                    trackingNumber: doc.trackingNumber,
                                    shippingCoCode: doc.shippingCoCode,
                                    shippingCoName: doc.shippingCoName,
                                    orderId: doc._id,
                                    orderUID: doc.orderUID,
                                    receiverName: doc.receiverName,
                                    phoneNumber: doc.phoneNumber,
                                    address: doc.address,
                                    zonecode: doc.zonecode,
                                    requestMessage: doc.requestMessage,
                                    buyer: {
                                        userId: doc.buyer.userId,
                                        uniqueId: doc.buyer.uniqueId,
                                        userUID: doc.buyer.userUID
                                    },
                                    items: []
                                }

                                doc.cartItem.forEach(item => {
                                    let orderedItem = {
                                        cartId: item._id,
                                        refundStatus: item.refundStatus,
                                        quantity: item.orderQuantity,
                                        orderStatus: item.orderStatus,
                                        shippingStatus: item.shippingStatus,
                                        option: {
                                            title: item.orderOption.title
                                        },
                                        product: {
                                            title: item.orderProduct.title,
                                            UID: item.orderProduct.productUID,
                                            shippingCost: item.orderProduct.shippingCost
                                        }
                                    }

                                    obj.items.push(orderedItem)
                                })

                                orders.push(obj)

                            });

                            res.json(orders);
                        })
                    })

                }
            }else{
                res.status(500).send()
            }
        })
})

router.get('/get/seller/refund/requested/item/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let sellerCollection = db.collection('SELLER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                if(user.isSeller){

                    sellerCollection.aggregate([
                        {$match: {uniqueId: new objectId(uniqueId)}},
                        {
                            $lookup: {
                                from: 'CART',
                                localField: '_id',
                                foreignField: 'seller._id',
                                as: 'cartItem'
                            }
                        },
                        {
                            $unwind: '$cartItem'
                        },
                        {
                            $match: {'cartItem.refundStatus' : util.REFUND_STATUS.REQUESTED}
                        },
                        {
                            $lookup: {
                                from: 'ORDER',
                                localField: 'cartItem.orderId',
                                foreignField: '_id',
                                as: 'order'
                            }
                        },
                        {
                            $unwind: '$order'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'order.uniqueId',
                                foreignField: '_id',
                                as:'buyer'
                            }
                        },
                        {
                            $unwind: '$buyer'
                        },
                        {
                            $group: {
                                _id:  '$order._id' ,
                                totalAmount: {$first: '$order.amt'},
                                buyer: {$first:'$buyer'},
                                orderUID: {$first: '$order.orderUID'},
                                //trackingNumber: trackingNumber, shippingCoCode: shippingCoCode, shippingCoName: shippingCoName
                                trackingNumber: {$first: '$order.trackingNumber'},
                                shippingCoCode: {$first: '$order.shippingCoCode'},
                                shippingCoName: {$first: '$order.shippingCoName'},
                                address: {$first: '$order.address'},
                                receiverName: {$first: '$order.receiverName'},
                                phoneNumber:  {$first: '$order.phoneNumber'},
                                zonecode:  {$first: '$order.zonecode'},
                                requestMessage:  {$first: '$order.requestMessage'},
                                cartItem: {$push: '$cartItem'}
                            }
                        }
                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send();
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){

                                throw e2;
                            }

                            let orders = [];

                            docs.forEach(doc => {
                                let obj = {
                                    totalAmount: parseInt(doc.totalAmount),
                                    trackingNumber: doc.trackingNumber,
                                    shippingCoCode: doc.shippingCoCode,
                                    shippingCoName: doc.shippingCoName,
                                    orderId: doc._id,
                                    orderUID: doc.orderUID,
                                    receiverName: doc.receiverName,
                                    phoneNumber: doc.phoneNumber,
                                    address: doc.address,
                                    zonecode: doc.zonecode,
                                    requestMessage: doc.requestMessage,
                                    buyer: {
                                        userId: doc.buyer.userId,
                                        uniqueId: doc.buyer.uniqueId,
                                        userUID: doc.buyer.userUID
                                    },
                                    items: []
                                }

                                doc.cartItem.forEach(item => {


                                    let orderedItem = {
                                        cartId: item._id,
                                        refundStatus: item.refundStatus,
                                        quantity: item.orderQuantity,
                                        orderStatus: item.orderStatus,
                                        shippingStatus: item.shippingStatus,
                                        option: {
                                            title: item.orderOption.title
                                        },
                                        product: {
                                            title: item.orderProduct.title,
                                            UID: item.orderProduct.productUID,
                                            shippingCost: item.orderProduct.shippingCost
                                        }
                                    }

                                    obj.items.push(orderedItem)
                                })

                                orders.push(obj)

                            });

                            res.json({count: orders.length});
                        })
                    })

                }else{
                    res.json({count: 0})
                }
            }else{
                res.status(500).send()
            }
        })
});


router.get('/get/seller/exchange/requested/item/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let sellerCollection = db.collection('SELLER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                if(user.isSeller){

                    sellerCollection.aggregate([
                        {$match: {uniqueId: new objectId(uniqueId)}},
                        {
                            $lookup: {
                                from: 'CART',
                                localField: '_id',
                                foreignField: 'seller._id',
                                as: 'cartItem'
                            }
                        },
                        {
                            $unwind: '$cartItem'
                        },
                        {
                            $match: {'cartItem.exchangeStatus' : util.EXCHANGE_STATUS.REQUESTED}
                        },
                        {
                            $lookup: {
                                from: 'ORDER',
                                localField: 'cartItem.orderId',
                                foreignField: '_id',
                                as: 'order'
                            }
                        },
                        {
                            $unwind: '$order'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'order.uniqueId',
                                foreignField: '_id',
                                as:'buyer'
                            }
                        },
                        {
                            $unwind: '$buyer'
                        },
                        {
                            $group: {
                                _id:  '$order._id' ,
                                totalAmount: {$first: '$order.amt'},
                                buyer: {$first:'$buyer'},
                                orderUID: {$first: '$order.orderUID'},
                                //trackingNumber: trackingNumber, shippingCoCode: shippingCoCode, shippingCoName: shippingCoName
                                trackingNumber: {$first: '$order.trackingNumber'},
                                shippingCoCode: {$first: '$order.shippingCoCode'},
                                shippingCoName: {$first: '$order.shippingCoName'},
                                address: {$first: '$order.address'},
                                receiverName: {$first: '$order.receiverName'},
                                phoneNumber:  {$first: '$order.phoneNumber'},
                                zonecode:  {$first: '$order.zonecode'},
                                requestMessage:  {$first: '$order.requestMessage'},
                                cartItem: {$push: '$cartItem'}
                            }
                        }
                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send();
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){

                                throw e2;
                            }

                            let orders = [];

                            docs.forEach(doc => {
                                let obj = {
                                    totalAmount: parseInt(doc.totalAmount),
                                    trackingNumber: doc.trackingNumber,
                                    shippingCoCode: doc.shippingCoCode,
                                    shippingCoName: doc.shippingCoName,
                                    orderId: doc._id,
                                    orderUID: doc.orderUID,
                                    receiverName: doc.receiverName,
                                    phoneNumber: doc.phoneNumber,
                                    address: doc.address,
                                    zonecode: doc.zonecode,
                                    requestMessage: doc.requestMessage,
                                    buyer: {
                                        userId: doc.buyer.userId,
                                        uniqueId: doc.buyer.uniqueId,
                                        userUID: doc.buyer.userUID
                                    },
                                    items: []
                                }

                                doc.cartItem.forEach(item => {
                                    let orderedItem = {
                                        cartId: item._id,
                                        exchangeStatus: item.exchangeStatus,
                                        quantity: item.orderQuantity,
                                        orderStatus: item.orderStatus,
                                        shippingStatus: item.shippingStatus,
                                        option: {
                                            title: item.orderOption.title
                                        },
                                        product: {
                                            title: item.orderProduct.title,
                                            UID: item.orderProduct.productUID,
                                            shippingCost: item.orderProduct.shippingCost
                                        }
                                    }

                                    obj.items.push(orderedItem)
                                })

                                orders.push(obj)

                            });

                            res.json({count: orders.length});
                        })
                    })

                }else{
                    res.json({count: 0})
                }
            }else{
                res.status(500).send()
            }
        })
})

router.post('/request/refund', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartId = req.body.cartId;

    let db = database.getDb();

    let cartCollection = db.collection('CART')

    cartCollection.updateOne({_id: new objectId(cartId)}, {$set: {refundStatus: util.REFUND_STATUS.REQUESTED}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })

})

router.post('/confirm/refund', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartId = req.body.cartId;

    let db = database.getDb();

    let cartCollection = db.collection('CART')

    cartCollection.updateOne({_id: new objectId(cartId)}, {$set: {refundStatus: util.REFUND_STATUS.CONFIRMED}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })

})

router.post('/request/exchange', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartId = req.body.cartId;

    let db = database.getDb();

    let cartCollection = db.collection('CART')

    cartCollection.updateOne({_id: new objectId(cartId)}, {$set: {exchangeStatus: util.EXCHANGE_STATUS.REQUESTED}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })

})

router.post('/confirm/exchange', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartId = req.body.cartId;

    let db = database.getDb();



    let cartCollection = db.collection('CART')

    cartCollection.updateOne({_id: new objectId(cartId)}, {$set: {exchangeStatus: util.EXCHANGE_STATUS.CONFIRMED}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })

})


router.post('/order/set/shipping', (req, res) => {
    let orderId = req.body.orderId;
    let trackingNumber = req.body.trackingNumber;
    let shippingCoCode = req.body.shippingCoCode;
    let shippingCoName = req.body.shippingCoName;
    let shippingStatus = req.body.shippingStatus;

    let db = database.getDb();

    let orderCollection = db.collection('ORDER');
    let cartCollection = db.collection('CART');


    orderCollection.updateOne({_id: new objectId(orderId)}, {$set: {trackingNumber: trackingNumber, shippingCoCode: shippingCoCode, shippingCoName: shippingCoName, shippingStatus: shippingStatus}}, {upsert: true})
        .then(result => {

            orderCollection.findOne({_id: new objectId(orderId)})
                .then(order => {
                    if(order !== null){
                        order.cartIds.forEach(cartId => {
                            cartCollection.updateOne({_id: cartId}, {$set: {shippingStatus: shippingStatus}})
                        })
                    }else{

                    }
                })
                .catch(err => {
                    res.status(500).send()

                    throw err;
                })

            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()

            throw err;
        })



})

router.post('/confirm/order', (req, res) => {
    let orderId = req.body.orderId;

    let db = database.getDb();

    let cartCollection = db.collection('CART');

    let orderCollection = db.collection('ORDER')

    orderCollection.findOne({_id: new objectId(orderId)})
        .then(order => {
            if(order !== null){
                order.cartIds.forEach(cartId => {
                    cartCollection.updateOne({_id: cartId}, {$set: {orderStatus: util.ORDER_STATUS.CONFIRMED}}, {upsert: true})

                })

                res.status(200).send()
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })

});

router.get('/get/shipping/company', (req, res) => {
   let companyList = (error, response, body) => {
       let list = JSON.parse(body);

       if(error){
           let result = {
               Company: util.SHIPPING_COMPANY
           };

           res.json(result)
       }else{


           res.json(list)
       }
   }

   tracker.getCompanyList(companyList)

});

router.get('/get/seller/order/items', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let sellerCollection = db.collection('SELLER');
    let orderCollection = db.collection('ORDER');

    orderCollection.aggregate([
        {
            $lookup: {
                from: 'CART',
                localField:'cartIds',
                foreignField: '_id',
                as: 'cart'
            }
        },
        {
            $unwind: '$cart'
        },

        {
            $lookup: {

                from: 'SELLER',
                localField: 'cart.seller._id',
                foreignField: '_id',
                as: 'sellerInfo'
            }
        },
        {
            $unwind: '$sellerInfo'
        },
        {
            $lookup: {
                from : 'USER',
                localField: 'sellerInfo.uniqueId',
                foreignField: '_id',
                as: 'seller'
            }
        },
        {
            $unwind: '$seller'
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'uniqueId',
                foreignField: '_id',
                as: 'buyer'
            }
        },
        {
            $unwind: '$buyer'
        },
        {
            $match: {'seller._id': new objectId(uniqueId)}
        },
        {
            $match: {'status' : 1}
        }

    ], (err, cursor) => {
       if(err){
           res.status(500).send();
           throw err;
       }

       cursor.toArray((e2, docs) => {
           if(e2){
               res.status(500).send();
               throw e2;
           }

           let orders = [];

           docs.forEach(doc => {
               let obj = {
                   totalAmount: parseInt(doc.amt),
                   trackingNumber: doc.trackingNumber,
                   shippingCoCode: doc.shippingCoCode,
                   shippingCoName: doc.shippingCoName,
                   shippingStatus: doc.shippingStatus,
                   orderId: doc._id,
                   orderUID: doc.orderUID,
                   receiverName: doc.receiverName,
                   phoneNumber: doc.phoneNumber,
                   address: doc.address,
                   zonecode: doc.zonecode,
                   requestMessage: doc.requestMessage,
                   totalOrderAmount:  doc.cart.orderProduct.price,
                   buyer: {
                       userId: doc.buyer.userId,
                       uniqueId: doc.buyer.uniqueId,
                       userUID: doc.buyer.userUID,
                       fullname: doc.buyer.fullname
                   },
                   items: [
                       {
                           cartId: doc.cart._id,
                           quantity: doc.cart.orderQuantity,
                           orderStatus: doc.cart.orderStatus,
                           shippingStatus: doc.cart.shippingStatus,
                           option: {
                               title: doc.cart.orderOption.title
                           },
                           product: {
                               title: doc.cart.orderProduct.title,
                               UID: doc.cart.orderProduct.productUID,
                               price: doc.cart.orderProduct.price,
                               discountRate: doc.cart.orderProduct.discountRate,
                               shippingCost: doc.cart.orderProduct.shippingCost
                           }
                       }
                   ]
               }

               // doc.cartItem.forEach(item => {
               //     let orderedItem = {
               //         quantity: item.orderQuantity,
               //         orderStatus: item.orderStatus,
               //         shippingStatus: item.shippingStatus,
               //         option: {
               //             title: item.orderOption.title
               //         },
               //         product: {
               //             title: item.orderProduct.title,
               //             UID: item.orderProduct.productUID,
               //             shippingCost: item.orderProduct.shippingCost
               //         }
               //     }
               //
               //     obj.items.push(orderedItem)
               // })

               orders.push(obj)
           })

           res.json(orders)
       })

    });

    // userCollection.findOne({_id: new objectId(uniqueId)})
    //     .then(user => {
    //         if(user !== null){
    //             if(user.isSeller){
    //
    //                 sellerCollection.aggregate([
    //                     {$match: {uniqueId: new objectId(uniqueId)}},
    //                     {
    //                         $lookup: {
    //                             from: 'CART',
    //                             localField: '_id',
    //                             foreignField: 'seller._id',
    //                             as: 'cartItem'
    //                         }
    //                     },
    //                     {
    //                         $unwind: '$cartItem'
    //                     },
    //
    //                     {
    //                         $match: {'cartItem.status' : 1}
    //                     },
    //                     {
    //                         $lookup: {
    //                             from: 'ORDER',
    //                             localField: 'cartItem.orderId',
    //                             foreignField: '_id',
    //                             as: 'order'
    //                         }
    //                     },
    //                     {
    //                         $unwind: '$order'
    //                     },
    //                     {
    //                         $lookup: {
    //                             from: 'USER',
    //                             localField: 'order.uniqueId',
    //                             foreignField: '_id',
    //                             as:'buyer'
    //                         }
    //                     },
    //                     {
    //                         $unwind: '$buyer'
    //                     },
    //                     {
    //                         $group: {
    //                             _id:  '$order._id' ,
    //                             totalAmount: {$first: '$order.amt'},
    //                             buyer: {$first:'$buyer'},
    //                             orderUID: {$first: '$order.orderUID'},
    //                             shippingStatus: {$first: '$order.shippingStatus'},
    //                             trackingNumber: {$first: '$order.trackingNumber'},
    //                             shippingCoCode: {$first: '$order.shippingCoCode'},
    //                             shippingCoName: {$first: '$order.shippingCoName'},
    //                             address: {$first: '$order.address'},
    //                             receiverName: {$first: '$order.receiverName'},
    //                             phoneNumber:  {$first: '$order.phoneNumber'},
    //                             zonecode:  {$first: '$order.zonecode'},
    //                             requestMessage:  {$first: '$order.requestMessage'},
    //                             cartItem: {$push: '$cartItem'}
    //                         }
    //                     }
    //                 ], (err, cursor) => {
    //                     if(err){
    //                         res.status(500).send();
    //                         throw err;
    //                     }
    //
    //                     cursor.toArray((e2, docs) => {
    //                         if(e2){
    //
    //                             throw e2;
    //                         }
    //
    //                         let orders = [];
    //
    //                         docs.forEach(doc => {
    //                             let obj = {
    //                                 totalAmount: parseInt(doc.totalAmount),
    //                                 trackingNumber: doc.trackingNumber,
    //                                 shippingCoCode: doc.shippingCoCode,
    //                                 shippingCoName: doc.shippingCoName,
    //                                 shippingStatus: doc.shippingStatus,
    //                                 orderId: doc._id,
    //                                 orderUID: doc.orderUID,
    //                                 receiverName: doc.receiverName,
    //                                 phoneNumber: doc.phoneNumber,
    //                                 address: doc.address,
    //                                 zonecode: doc.zonecode,
    //                                 requestMessage: doc.requestMessage,
    //                                 buyer: {
    //                                     userId: doc.buyer.userId,
    //                                     uniqueId: doc.buyer.uniqueId,
    //                                     userUID: doc.buyer.userUID,
    //                                     fullname: doc.buyer.fullname
    //                                 },
    //                                 items: []
    //                             }
    //
    //                             doc.cartItem.forEach(item => {
    //                                 let orderedItem = {
    //                                     quantity: item.orderQuantity,
    //                                     orderStatus: item.orderStatus,
    //                                     shippingStatus: item.shippingStatus,
    //                                     option: {
    //                                         title: item.orderOption.title
    //                                     },
    //                                     product: {
    //                                         title: item.orderProduct.title,
    //                                         UID: item.orderProduct.productUID,
    //                                         shippingCost: item.orderProduct.shippingCost
    //                                     }
    //                                 }
    //
    //                                 obj.items.push(orderedItem)
    //                             })
    //
    //                             orders.push(obj)
    //
    //                         });
    //
    //                         res.json(orders);
    //                     })
    //                 })
    //
    //             }else{
    //                 res.json([])
    //             }
    //         }else{
    //             res.status(500).send()
    //         }
    //     })
})

router.get('/get/application', (req, res) => {
    let uniqueId = req.query.uniqueId

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }


    let db = database.getDb();

    let userCollection = db.collection('USER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){
                    userCollection.aggregate([
                        {
                            $facet: {
                                'influencerApplication': [
                                    {
                                        $lookup:{
                                            from:'INFLUENCER_APPLICATION',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'influencerApplication'
                                        }
                                    },
                                    {
                                        $unwind:{
                                            path: '$influencerApplication',
                                            preserveNullAndEmptyArrays: true
                                        }
                                    },
                                    {
                                        $match: {influencerApplication: {$exists: true}}
                                    }
                                ],

                                'sellerApplication': [
                                    {
                                        $lookup: {
                                            from:'SELLER_APPLICATION',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'sellerApplication'
                                        }
                                    },
                                    {
                                        $unwind : {
                                            path: '$sellerApplication',
                                            preserveNullAndEmptyArrays: true
                                        }
                                    },
                                    {
                                        $match: {sellerApplication: {$exists: true}}
                                    }
                                ],
                                'userApplications': [
                                    {
                                        $lookup: {
                                            from:'SELLER_APPLICATION',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'userSellerApplication'
                                        }
                                    },
                                    {
                                        $unwind : {
                                            path: '$userSellerApplication'
                                        }
                                    },
                                    {
                                        $lookup:{
                                            from:'INFLUENCER_APPLICATION',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'userInfluencerApplication'
                                        }
                                    },
                                    {
                                        $unwind:{
                                            path: '$userInfluencerApplication'
                                        }
                                    },

                                ]
                            }
                        },
                        {$project: { applications:{$setUnion:['$influencerApplication','$sellerApplication', '$userApplications']}}},
                        {$unwind: '$applications'},
                        {$replaceRoot: { newRoot: "$applications" }}

                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send()
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){
                                res.status(500).send();
                                throw e2;
                            }

                            let applications = [];

                            docs.forEach(doc => {

                                let application = {
                                    uniqueId: doc._id,
                                    applicationId: '',
                                    firstName: doc.fullName,
                                    lastName: '',
                                    fullName: doc.fullName,
                                    userId: doc.userId,
                                    email: doc.email,
                                    instagram: doc.instagram,
                                    youtube: doc.youtube,
                                    blog: doc.blog,
                                    sellerApplication: {},
                                    influencerApplication: {},
                                    date: doc.date,
                                    isActive: doc.isActive,
                                    isSeller: false,
                                    isInfluencer: false
                                }

                                if(doc.influencerApplication !== undefined){
                                    application.influencerApplication = doc.influencerApplication
                                    application.influencerApplication.applicationId = doc.influencerApplication._id
                                    application.applicationId = doc.influencerApplication._id
                                }

                                if(doc.sellerApplication !== undefined){
                                    application.sellerApplication = doc.sellerApplication
                                    application.sellerApplication.applicationId = doc.sellerApplication._id
                                    application.applicationId = doc.sellerApplication._id
                                }

                                if(doc.sellerApplication === undefined && doc.influencerApplication === undefined){

                                }else{
                                    applications.push(application)
                                }



                            });




                            res.json(applications)
                        })
                    })
                }else{

                }
            }
        })
        .catch(err => {
            res.status(500).send()

            throw err;
        })
});

router.post('/approve/influencer', (req, res) =>  {
    let applicationId = req.body.applicationId
    let db = database.getDb()
    let influencerApplicationCollection = db.collection('INFLUENCER_APPLICATION');
    let influencerCollection = db.collection('INFLUENCER');
    let userCollection = db.collection('USER');

    influencerApplicationCollection.findOne({_id: new objectId(applicationId)})
        .then(application => {
            if(application !== null ){
                influencerApplicationCollection.updateOne({_id: new objectId(applicationId)}, {$set: {isApproved: true, isDenied: false}}, {upsert: true})
                    .then(r2 => {

                        userCollection.updateOne({_id: application.uniqueId}, {$set: {isInfluencer: true}})
                    })
                    .then(() => {

                        let obj = application
                        delete obj._id;
                        obj.isApproved = true;
                        obj.influencerUID = 'IF'+getUid()
                        influencerCollection.insertOne(obj)
                    })
                    .then(() => {

                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                })
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});


router.post('/deny/influencer', (req, res) =>  {
    let applicationId = req.body.applicationId
    let db = database.getDb()
    let influencerApplicationCollection = db.collection('INFLUENCER_APPLICATION');
    let influencerCollection = db.collection('INFLUENCER')

    influencerApplicationCollection.findOne({_id: new objectId(applicationId)})
        .then(application => {
            if(application !== null ){
                influencerApplicationCollection.updateOne({_id: new objectId(applicationId)}, {$set: {isApproved: false, isDenied: true}}, {upsert: true})
                    .then(r2 => {
                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                    })
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});


router.post('/cancel/influencer', (req, res) =>  {
    let applicationId = req.body.applicationId
    let db = database.getDb()
    let influencerApplicationCollection = db.collection('INFLUENCER_APPLICATION');
    let influencerCollection = db.collection('INFLUENCER');
    let userCollection = db.collection('USER');

    influencerApplicationCollection.findOne({_id: new objectId(applicationId)})
        .then(application => {
            if(application !== null ){
                influencerApplicationCollection.updateOne({_id: new objectId(applicationId)}, {$set: {isApproved: false}}, {upsert: true})
                    .then(r2 => {

                        userCollection.updateOne({_id: application.uniqueId}, {$set: {isInfluencer: false}})
                    })
                    .then(() => {

                        influencerCollection.deleteOne({uniqueId: application.uniqueId})
                    })
                    .then(() => {
                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                    })
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.post('/approve/seller', (req, res) =>  {
    let applicationId = req.body.applicationId
    let db = database.getDb()
    let sellerApplicationCollection = db.collection('SELLER_APPLICATION')
    let sellerCollection = db.collection('SELLER');
    let userCollection = db.collection('USER');

    sellerApplicationCollection.findOne({_id: new objectId(applicationId)})
        .then(application => {
            if(application !== null ){
                sellerApplicationCollection.updateOne({_id: new objectId(applicationId)}, {$set: {isApproved: true, isDenied: false}}, {upsert: true})
                    .then(r2 => {

                        userCollection.updateOne({_id: application.uniqueId}, {$set: {isSeller: true}})
                    })
                    .then(() => {

                        let obj = application
                        delete obj._id;
                        obj.isApproved = true;
                        obj.sellerUID = 'S'+getUid()
                        sellerCollection.insertOne(obj)
                    })
                    .then(() => {


                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                    })
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});


router.post('/deny/seller', (req, res) =>  {
    let applicationId = req.body.applicationId
    let db = database.getDb()
    let sellerApplicationCollection = db.collection('SELLER_APPLICATION')
    let sellerCollection = db.collection('SELLER')

    sellerApplicationCollection.findOne({_id: new objectId(applicationId)})
        .then(application => {
            if(application !== null ){
                sellerApplicationCollection.updateOne({_id: new objectId(applicationId)}, {$set: {isApproved: false, isDenied: true}}, {upsert: true})
                    .then(r2 => {
                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                    })
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});


router.post('/cancel/seller', (req, res) =>  {
    let applicationId = req.body.applicationId
    let db = database.getDb()
    let sellerApplicationCollection = db.collection('SELLER_APPLICATION')
    let sellerCollection = db.collection('SELLER')
    let userCollection = db.collection('USER');

    sellerApplicationCollection.findOne({_id: new objectId(applicationId)})
        .then(application => {
            if(application !== null ){
                sellerApplicationCollection.updateOne({_id: new objectId(applicationId)}, {$set: {isApproved: false}}, {upsert: true})
                    .then(r2 => {

                        userCollection.updateOne({_id: application.uniqueId}, {$set: {isSeller: false}})
                    })
                    .then(() => {

                        sellerCollection.deleteOne({uniqueId: application.uniqueId})
                    })
                    .then(() => {
                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                    })
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.post('/activate/user', (req, res) => {
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();

    let userCollection = db.collection('USER');

    userCollection.updateOne({_id: new objectId(uniqueId)}, {$set: {isActive: true}})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            throw err;
        })
});

router.post('/block/user', (req, res) => {
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();

    let userCollection = db.collection('USER');

    userCollection.updateOne({_id: new objectId(uniqueId)}, {$set: {isActive: false}})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            throw err;
        })
});


router.post('/save/hashTag', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTag = req.body.hashTag;

    let db = database.getDb();

    let savedManagerHashTagCollection = db.collection('MANAGER_SAVED_HASH_TAG');

    let obj = {
        uniqueId: new objectId(uniqueId),
        hashTag: hashTag
    }

    savedManagerHashTagCollection.findOne(obj)
        .then(result => {
            if(result === null){
                savedManagerHashTagCollection.insertOne(obj)
                    .then(r => {
                        res.status(200).send()
                    })
                    .catch(e => {
                        res.status(500).send();
                        throw e;
                    })
            }else{
                res.status(200).send()
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.post('/delete/hashTag', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTag = req.body.hashTag;

    let db = database.getDb();
    let savedManagerHashTagCollection = db.collection('MANAGER_SAVED_HASH_TAG');

    let obj = {
        uniqueId: new objectId(uniqueId),
        hashTag: hashTag
    }

    savedManagerHashTagCollection.deleteOne(obj)
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/get/savedHashTags', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json([]);
        return;
    }

    let db = database.getDb();
    let savedManagerHashTagCollection = db.collection('MANAGER_SAVED_HASH_TAG');

    savedManagerHashTagCollection.aggregate([
        {
            $match: {
                uniqueId: new objectId(uniqueId)
            }
        },
        {
            $limit: 20
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2
            }

            let hashTags = [];

            docs.forEach(doc => {
                hashTags.push(doc.hashTag)
            });



            res.json(hashTags)
        })

    })


});

router.post('/request/matching', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let productId = req.body.productId;

    let db = database.getDb()

    let matchingRequestCollection = db.collection('MATCH_PRODUCT');
    let notificationCollection = db.collection('NOTIFICATION');
    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');
    let productCollection = db.collection('PRODUCT');
    let matchRequestThreadCollection = db.collection('MATCH_REQUEST_THREAD');

    let obj = {
        uniqueId: new objectId(uniqueId),
        productId: new objectId(productId)
    }

    matchingRequestCollection.findOne(obj)
        .then(result => {
            if(result === null){
                obj.isConfirmed = false;

                matchingRequestCollection.insertOne(obj)
                    .then(matchRequest => {

                        setNotification(uniqueId, productId, matchRequest.insertedId )


                        res.status(200).send()
                    })
                    .catch(err => {
                        res.status(500).send();
                        throw err;
                    })
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })

    let setNotification = (requesterId, productId, matchRequestId) => {


        productCollection.aggregate([
            {$match: {_id: new objectId(productId)}},
            {
                $lookup: {
                    from: 'SELLER',
                    localField: 'sellerId',
                    foreignField: '_id',
                    as: 'seller'
                }
            },
            {
                $unwind: '$seller'
            },
            {
                $lookup:{
                    from: 'USER',
                    localField: 'seller.uniqueId',
                    foreignField: '_id',
                    as:'owner'
                }
            },
            {
                $unwind: '$owner'
            }
        ], (err, cursor) => {
            if(err){
                throw err;
            }

            cursor.toArray((e2, docs) => {
                let notiObj = {}
                let notiSentObj = {}
                let date = new Date();

                matchRequestThreadCollection.insertOne({type:'SENT', matchRequestId: matchRequestId})
                    .then(thread => {
                        let threadId = thread.insertedId


                        docs.forEach(doc => {



                            notiObj = {
                                threadId: threadId,
                                notificationType: util.NOTIFICATION_TYPE.MATCH_REQUEST,
                                ownerUniqueId: doc.owner._id,
                                requesterId: new objectId(requesterId),
                                matchRequestId: matchRequestId,
                                productId: new objectId(productId),
                                date: date
                            }

                            notiSentObj = {
                                threadId: threadId,
                                notificationType: util.NOTIFICATION_TYPE.MATCH_REQUEST_SENT,
                                ownerUniqueId:new objectId(requesterId),

                                matchRequestId: matchRequestId,
                                productId: new objectId(productId),
                                date: date
                            }
                        });

                        notificationCollection.insertOne(notiObj)
                            .then(r2 => {
                                notificationCountCollection.updateOne({uniqueId: notiObj.ownerUniqueId}, {$inc: {count: 1}},  {upsert: true} )
                            })
                            .catch(err => {
                                throw err;
                            })

                        notificationCollection.insertOne(notiSentObj)
                            .then(r2 => {
                                notificationCountCollection.updateOne({uniqueId: notiSentObj.ownerUniqueId}, {$inc: {count: 1}},  {upsert: true} )
                            })
                            .catch(err => {
                                throw err;
                            })


                    })
                    .catch(err => {
                        throw err;
                    })



            })
        })




    }

});

router.post('/unrequest/matching', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let productId = req.body.productId;

    let db = database.getDb()

    let matchingRequestCollection = db.collection('MATCH_PRODUCT');

    let obj = {
        uniqueId: new objectId(uniqueId),
        productId: new objectId(productId)
    }



    matchingRequestCollection.deleteOne(obj)
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })


});

router.get('/search/product', (req, res) => {
    let db = database.getDb();
    let keyword = req.query.keyword;
    let keywords = keyword.split(/[\s,"]+/);

    let productCollection = db.collection('PRODUCT');

    let inArray = []

    keywords.forEach(word => {
        let regex = new RegExp([word].join(''), 'i');
        inArray.push(regex)
    });

    productCollection.aggregate([
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
                foreignField: 'productId',
                as: 'hashTags'
            }
        },
        {
            $unwind: {
                path: '$hashTags',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'productId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'PRODUCT_OPTION',
                localField: '_id',
                foreignField: 'productId',
                as:'options'
            }
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                localField: '_id',
                foreignField: 'productId',
                as: 'matchProduct'
            }
        },
        {
            $unwind: {
                path: '$matchProduct',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'productId',
                as: 'feedProduct'
            }
        },
        {
            $unwind: {
                path: '$feedProduct',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'SELLER',
                localField: 'sellerId',
                foreignField: '_id',
                as: 'seller'
            }

        },
        {
            $unwind: {
                path: '$seller',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$title'},
                subtitle: {$first: '$subtitle'},
                images: {$addToSet: {productId: '$_id', filename: '$images.filename', productImageType: '$images.productImageType'}},
                price: {$first: '$price'},
                currency: {$first: '$currency'},
                discountRate: {$first: '$discountRate'},
                options: {$first: '$options'},
                inventory: {$first: '$totalInventory'},
                matchProduct: {$first: '$matchProduct'},
                feedProduct: {$first: 'feedProduct'},
                seller: {$first:'$seller'}
            }
        },
        {
            $project: {
                _id: 1,
                hashTags:1,
                title: 1,
                images:1,
                subtitle: 1,
                price: 1,
                currency: 1,
                discountRate: 1,
                optionCount: {$size: '$options'},
                inventory: 1,
                matchProduct: 1,
                feedProduct: 1,
                seller: 1

            }
        },
        {
            $match: {$or: [{subtitle: {$in : inArray}}, {title: {$in: inArray}}, {hashTags: {$in: inArray}}, {'seller.sellerName': {$in : inArray}} ]}
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let products = [];

            docs.forEach(doc => {




                let images = []

                doc.images.forEach(image => {


                    if(image.productImageType === undefined){
                        images.push(image.filename)
                    }else{
                        if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                            images.push(image.filename)
                        }
                    }
                });





                let obj = {
                    _id: doc._id,
                    productId: doc._id,
                    hashTags: doc.hashTags,
                    title: doc.title,
                    subtitle: doc.subtitle,
                    images: [],
                    price: doc.price,
                    currency: doc.currency,
                    discountRate: doc.discountRate,
                    optionCount: doc.optionCount,
                    inventory: doc.inventory,
                    isConfirmed: false,
                    isRequested: false,
                    feedProduct: {}

                }

                obj.images = images

                if(doc.matchProduct !== null){


                    obj.isConfirmed = doc.matchProduct.isConfirmed;
                    obj.isRequested = true;
                    obj.isRejected = doc.matchProduct.isRejected;


                }

                if(doc.feedProduct !== null){
                    obj.feedProduct = doc.feedProduct
                }

                products.push(obj)

            })

            res.json(products)
        })
    })
});


router.get('/get/match/applied', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();


    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.json([])
        return
    }

    let matchProductCollection = db.collection('MATCH_PRODUCT');

    matchProductCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from:'PRODUCT',
                localField:'productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'productId',
                foreignField: 'productId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'PRODUCT_OPTION',
                localField: 'productId',
                foreignField: 'productId',
                as:'options'
            }
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: 'productId',
                foreignField:'productId',
                as:'feedProduct'
            }
        },
        {
            $unwind: {
                path: '$feedProduct',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                product: {$first: '$product'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$product.title'},
                subtitle: {$first: '$product.subtitle'},
                images: {$addToSet: {productId: '$_id', filename: '$images.filename', productImageType: '$images.productImageType'}},
                price: {$first: '$product.price'},
                currency: {$first: '$product.currency'},
                discountRate: {$first: '$product.discountRate'},
                options: {$first: '$options'},
                inventory: {$first: '$product.totalInventory'},
                isConfirmed: {$first: '$isConfirmed'},
                isRejected: {$first: '$isRejected'},
                feedProduct: {$first: '$feedProduct'},
                commissionRate: {$first: '$commissionRate'}
            }
        },
        {
            $project: {
                _id: 1,
                product: 1,
                uniqueId: 1,
                hashTags:1,
                title: 1,
                commissionRate: 1,
                images:1,
                subtitle: 1,
                price: 1,
                currency: 1,
                discountRate: 1,
                optionCount: {$size: '$options'},
                inventory: 1,
                matchProduct: 1,
                isConfirmed: 1,
                isRejected: 1,
                feedProduct: 1

            }
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send()
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send()
                throw e2;
            }

            let products = [];

            docs.forEach(doc => {

                let images = [];

                doc.images.forEach(image => {
                    if(image.productImageType === undefined){
                        images.push(image.filename)
                    }else{
                        if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                            images.push(image.filename)
                        }
                    }
                });

                let obj = {
                    _id: doc._id,
                    productId: doc.product._id,
                    hashTags: doc.hashTags,
                    title: doc.title,
                    subtitle: doc.subtitle,
                    images: [],
                    price: doc.price,
                    currency: doc.currency,
                    discountRate: doc.discountRate,
                    optionCount: doc.optionCount,
                    inventory: doc.inventory,
                    isConfirmed: doc.isConfirmed,
                    isRejected: doc.isRejected,
                    isRequested: true,
                    feedProduct: {},
                    commissionRate: 0

                }

                obj.images = images

                if(doc.feedProduct !== null){
                    obj.feedProduct = doc.feedProduct
                }

                if(doc.commissionRate !== undefined){
                    obj.commissionRate = doc.commissionRate
                }

                products.push(obj)

            })

            res.json(products)
        })
    })
});

router.get('/get/matching/requested', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.json([])
        return
    }




    let db = database.getDb();

    let sellerCollection = db.collection('SELLER');

    sellerCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from: 'PRODUCT',
                localField: '_id',
                foreignField: 'sellerId',
                as: 'products'

            }
        },

        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                localField: "products._id",
                foreignField: 'productId',
                as:'matchRequest'
            }
        },
        {
            $unwind: {
                path: '$matchRequest',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'PRODUCT',
                localField: 'matchRequest.productId',
                foreignField: '_id',
                as: 'matchProduct'
            }
        },
        {
            $unwind: {
                path: '$matchProduct',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'matchProduct._id',
                foreignField: 'productId',
                as: 'productImages'
            }
        },

        {
            $lookup: {
                from: 'USER',
                localField: 'matchRequest.uniqueId',
                foreignField: '_id',
                as: 'matchRequester'
            }
        },
        {
            $unwind: '$matchRequester'
        },
        {
            $lookup: {
                from: 'FOLLOW',
                localField: 'matchRequester._id',
                foreignField: 'followeeId',
                as: 'followers'
            }
        }
    ],(err, cursor) => {
        if(err){
            res.status(500).send()
            throw err;
        }

        let requests = []

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }

            docs.forEach(doc => {




                let obj = {
                    matchRequestId: doc.matchRequest._id,
                    matchProductId: doc.matchProduct._id,
                    isConfirmed: doc.matchRequest.isConfirmed,
                    commissionRate: 0,
                    requester: {
                        uniqueId: doc.matchRequester._id,
                        userId: doc.matchRequester.userId,
                        followers: doc.followers.length,
                        instagram: doc.matchRequester.instagram
                    },
                    matchProduct: {
                        productId: doc.matchProduct._id,
                        title: doc.matchProduct.title,
                        price: doc.matchProduct.price,
                        currency: doc.matchProduct.currency,
                        discountRate: doc.matchProduct.discountRate,
                        matchingPeriod: 3,

                        images: []
                    }
                }


                if(doc.matchRequest.commissionRate !== undefined){
                    obj.commissionRate = doc.matchRequest.commissionRate;
                }

                doc.productImages.forEach(image => {
                    if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                        obj.matchProduct.images.push(image.filename)
                    }
                });


                requests.push(obj)
            })

            res.json(requests)
        })
    })

});

router.post('/confirm/matching', (req, res) => {
    let requestId = req.body.requestId;
    let commissionRate = req.body.commissionRate;


    let db = database.getDb();

    let matchProductCollection = db.collection('MATCH_PRODUCT');
    let notificationCollection = db.collection('NOTIFICATION');
    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');

    matchProductCollection.updateOne({_id: new objectId(requestId)}, {$set: {isConfirmed: true, isRejected: false, commissionRate: parseFloat(commissionRate)}}, {upsert: true})
        .then(result => {

            notificationCollection.updateMany({matchRequestId: new objectId(requestId)}, {$set: {date: new Date(), notificationType: util.NOTIFICATION_TYPE.MATCH_REQUEST_CONFIRM}})
                .then(r2 => {
                    notificationCollection.find({matchRequestId: new objectId(requestId)}).toArray((err, docs) => {
                        if(err){
                            throw err;
                        }

                        docs.forEach(doc => {
                            let ownerUniqueId = doc.ownerUniqueId;

                            notificationCountCollection.updateOne({uniqueId: ownerUniqueId}, {$inc: {count: 1}})
                        })
                    })

                })

            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send();

            throw err;
        })

});

router.post('/unconfirm/matching', (req, res) => {
    let requestId = req.body.requestId;

    let db = database.getDb();

    let matchProductCollection = db.collection('MATCH_PRODUCT');
    let notificationCollection = db.collection('NOTIFICATION');
    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');


    matchProductCollection.updateOne({_id: new objectId(requestId)}, {$set: {isConfirmed: false, isRejected: true}}, {upsert: true})
        .then(result => {

            notificationCollection.updateMany({matchRequestId: new objectId(requestId)}, {$set: {date: new Date(), notificationType: util.NOTIFICATION_TYPE.MATCH_REQUEST_CANCEL}})
                .then(r2 => {
                    notificationCollection.find({matchRequestId: new objectId(requestId)}).toArray((err, docs) => {
                        if(err){
                            throw err;
                        }

                        docs.forEach(doc => {
                            let ownerUniqueId = doc.ownerUniqueId;

                            notificationCountCollection.updateOne({uniqueId: ownerUniqueId}, {$inc: {count: 1}})
                        })
                    })

                })

            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send();

            throw err;
        })

});

router.get('/seller/get/product', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let sellerCollection = db.collection('SELLER');

    sellerCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from: 'PRODUCT',
                localField: '_id',
                foreignField: 'sellerId',
                as:'products'
            }
        },
        {
            $unwind: {
                path: '$products',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'PRODUCT_OPTION',
                localField: 'products._id',
                foreignField: 'productId',
                as:'options'
            }
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send()
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }

            let products = [];

            docs.forEach(doc => {

                let obj = {
                    sellerName: doc.sellerName,
                    sellerUID: doc.sellerUID,
                    product: doc.products


                };

                obj.product.productId = doc.products._id;

                if(doc.options !== null){
                    obj.product.options = doc.options.length
                }else{
                    obj.product.options = 0
                }


                products.push(obj)
            });

            res.json(products)
        })
    })
});

router.get('/get/product/detail', (req, res) => {
   let uniqueId = req.query.uniqueId;
   let productId = req.query.productId;

   let db = database.getDb();

   let productCollection = db.collection('PRODUCT');

    if(productId === 'null' || productId === 'undefined' || productId === undefined || productId === null){
        res.status(200).send();
        return
    }

   productCollection.aggregate([
       {
           $match: {_id: new objectId(productId)}
       },
       {
           $lookup:{
               from:'HASH_TAG',
               localField: '_id',
               foreignField: 'productId',
               as: 'hashTags'
           }
       },
       {
           $lookup:{
               from:'IMAGE',
               localField: '_id',
               foreignField: 'productId',
               as: 'productImages'
           }
       },
       {
           $lookup:{
               from:'PRODUCT_OPTION',
               localField: '_id',
               foreignField: 'productId',
               as: 'options'
           }
       }
   ], (err, cursor) => {
       if(err){
           res.status(500).send()
           throw err;
       }

       cursor.toArray((e2, docs) => {
           if(e2){
               res.status(500).send()
               throw e2;
           }

           let product = {}

           docs.forEach(doc => {

               product = {
                   productId: doc._id,
                   title: doc.title,
                   price: doc.price,
                   description : doc.description,
                   commission: doc.commission,
                   discountRate: doc.discountRate,
                   shippingCost: doc.shippingCost,
                   extraShippingCost: doc.extraShippingCost,
                   totalInventory: doc.totalInventory,
                   hashTags: [],
                   productImages: [],
                   descriptionImages: [],
                   options: []
               };

               if(doc.hashTags !== null){
                    doc.hashTags.forEach(tag => {
                        let obj = {
                            hashTagId: tag._id,
                            hashTag: tag.hashTag
                        }

                        product.hashTags.push(obj)
                    })
               }

               if(doc.options !== null){
                    doc.options.forEach(option => {
                        let obj = {
                            optionId: option._id,
                            title: option.title,
                            priceAddition: option.priceAddition,
                            inventory: option.inventory
                        }

                        product.options.push(obj)
                    })
               }

               doc.productImages.forEach(image => {

                   if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                       let imageObj = {
                           imageId: image._id,
                           filename: image.filename
                       }

                       product.productImages.push(imageObj)
                   }

                   if(image.productImageType === util.PRODUCT_IMAGE_TYPE.DESCRIPTION){
                       let imageObj = {
                           imageId: image._id,
                           filename: image.filename
                       };

                       product.descriptionImages.push(imageObj)
                   }
               })
           })




           res.json(product)
       })
   })
});

router.post('/add/match/request/comment', (req, res) => {
    let reviewerId = req.body.reviewerId;
    let threadId = req.body.threadId;
    let matchRequestId = req.body.matchRequestId;
    let notificationId = req.body.notificationId;
    let lastCommentId = req.body.lastCommentId;

    let comment = req.body.comment;

    let db = database.getDb();

    let notificationCollection = db.collection('NOTIFICATION');
    let matchRequestCommentCollection = db.collection('MATCH_REQUEST_COMMENT');
    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');

    notificationCollection.findOne({_id: new objectId(notificationId)})
        .then(notification => {
            if(notification !== null){
                if(reviewerId === notification.ownerUniqueId.toString()){

                }else{
                    notificationCountCollection.updateOne({uniqueId: notification.ownerUniqueId}, {$inc: {count: 1}},  {upsert: true} )
                }

                notificationCollection.updateOne({_id: new objectId(notificationId)}, {$set:{date: new Date()}})

                let commentObj = {
                    threadId: new objectId(threadId),
                    notificationId: new objectId(notificationId),
                    matchRequestId: new objectId(matchRequestId),
                    uniqueId: new objectId(reviewerId),
                    comment: comment
                }

                matchRequestCommentCollection.insertOne(commentObj)
                    .then(result => {
                        if(lastCommentId !== undefined && lastCommentId !== null){
                            matchRequestCommentCollection.aggregate([
                                {$match: {threadId: new objectId(threadId)}},
                                {
                                    $match:
                                        {$and: [ { _id: {$gt: new objectId(lastCommentId) }}, {_id: {$lte: result.insertedId}}]}
                                },
                                {
                                    $lookup: {
                                        from: 'USER',
                                        localField:'uniqueId',
                                        foreignField: '_id',
                                        as: 'user'
                                    }
                                },
                                {
                                    $unwind: '$user'
                                }
                            ], (err, cursor) => {
                                if(err){
                                    throw err;
                                }

                                let comments = [];
                                cursor.toArray((e2, docs) => {
                                    if(e2){
                                        throw e2;
                                    }

                                    docs.forEach(doc => {
                                        let obj = {
                                            commentId: doc._id,
                                            comment: doc.comment,

                                            user: {}
                                        }
                                        obj.user.uniqueId = doc.user._id;
                                        obj.user.userId = doc.user.userId;


                                        comments.push(obj)
                                    })

                                    res.json(comments)
                                })
                            })
                        }else{
                            matchRequestCommentCollection.aggregate([
                                {
                                    $match: { _id: result.insertedId}
                                },
                                {
                                    $lookup: {
                                        from: 'USER',
                                        localField:'uniqueId',
                                        foreignField: '_id',
                                        as: 'user'
                                    }
                                },
                                {
                                    $unwind: '$user'
                                }
                            ], (err, cursor) => {
                                if(err){
                                    throw err;
                                }

                                cursor.toArray((e2, docs) => {
                                    if(e2){
                                        throw e2;
                                    }

                                    let comments = [];
                                    docs.forEach( doc => {
                                        let obj = {
                                            commentCommentForumId: doc._id,
                                            comment: doc.comment,
                                            mentionUser: doc.mentionUser,
                                            user: {}
                                        }
                                        obj.user.uniqueId = doc.user._id;
                                        obj.user.userId = doc.user.userId;

                                        comments.push(obj)
                                    })

                                    res.json(comments)
                                })
                            })
                        }
                    })

            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});


router.get('/get/match/request/comment', (req, res) => {
    let threadId = req.query.threadId;

    let db = database.getDb();

    let matchRequestCommentCollection = db.collection('MATCH_REQUEST_COMMENT');

    matchRequestCommentCollection.aggregate([
        {$match: {threadId: new objectId(threadId)}},
        {
            $lookup: {
                from: 'USER',
                localField: 'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send();
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }

            let comments = [];

            docs.forEach(doc => {
                let obj = {
                    commentId: doc._id,
                    comment: doc.comment,
                    user: {}
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                comments.push(obj)
            });

            res.json(comments);
        })
    })

});

router.get('/get/admin/full/report', (req, res) => {
   let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json({revenue: []});
        return;
    }


   let startDate = req.query.startDate;
   let endDate = req.query.endDate;

   let db = database.getDb();

   let userCollection = db.collection('USER');
   let cartCollection = db.collection('CART');
   let orderCollection = db.collection('ORDER');


   userCollection.findOne({_id: new objectId(uniqueId)})
       .then(user => {
           if(user !== null){
               //if(user.isAdmin){
               if(true){
                   cartCollection.aggregate([

                       {$match: {status: 1}},
                       {
                           $lookup: {
                               from: 'INFLUENCER',
                               localField: 'influencerId',
                               foreignField: '_id',
                               as: 'influencerInfo'
                           }
                       },
                       {
                           $unwind: '$influencerInfo'
                       },
                       {
                           $lookup: {
                               from: 'USER',
                               localField: 'influencerInfo.uniqueId',
                               foreignField: '_id',
                               as: 'influencerPersonalInfo'
                           }
                       },
                       {
                           $unwind: '$influencerPersonalInfo'
                       },
                       {
                           $lookup: {
                               from: 'USER',
                               localField: 'seller.uniqueId',
                               foreignField: '_id',
                               as: 'sellerPersonalInfo'
                           }
                       },
                       {
                           $unwind: '$sellerPersonalInfo'
                       },
                       {
                           $lookup: {
                               from: 'USER',
                               localField: 'uniqueId',
                               foreignField: '_id',
                               as: 'buyer'
                           }
                       },
                       {
                           $unwind: '$buyer'
                       },
                       {
                           $lookup: {
                               from: 'ORDER',
                               localField: 'orderId',
                               foreignField: '_id',
                               as: 'order'
                           }
                       },
                       {
                           $unwind: {
                               path: '$order'
                           }
                       },
                       {
                           $lookup: {
                               from: 'MATCH_PRODUCT',
                               let: { 'purchasedProductId': '$productId', 'influencerUniqueId': '$influencerPersonalInfo._id' },
                               pipeline: [
                                   {
                                       $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                                   }
                               ],
                               as: 'match'
                           }
                       },
                       {
                           $unwind: '$match'
                       },
                       {
                           $match: { $and : [{date:{$gte: new Date(startDate) }}, {date: {$lte: new Date(endDate) }}]}
                       }

                   ], (err, cursor) => {
                       if(err){
                           throw err;
                       }

                       cursor.toArray((e2, docs) => {
                           if(e2){
                               throw e2;
                           }

                           let report = {
                               revenue: []
                           };

                           docs.forEach(doc => {

                               let obj = {
                                   date: doc.date,
                                   orderID: doc.order.orderUID,
                                   saleType: doc.purchaseType,

                                   totalSoldQuantity: doc.orderQuantity,

                                   product: {
                                       currency: doc.orderProduct.currency,
                                       title: doc.orderProduct.title,
                                       sellingPrice: doc.orderProduct.price,
                                       productId: doc.orderProduct.productUID,
                                       option: {
                                           optionName: (doc.orderOption.title === '추가 옵션이 없습니다.') ? '없음' : doc.orderOption.title,
                                           additionalCost: doc.orderOption.priceAddition,
                                       },
                                       discountRate: doc.orderProduct.discountRate,
                                       commissionRate: doc.match.commissionRate,
                                       totalShippingCost: doc.orderProduct.shippingCost,
                                   },

                                   influencer: {
                                       uniqueId: doc.influencerPersonalInfo._id,
                                       firstName: doc.influencerPersonalInfo.fullName,
                                       lastName: '',
                                       fullName: doc.influencerPersonalInfo.fullName,
                                       userUID: doc.influencerPersonalInfo.userUID,
                                       userId: doc.influencerPersonalInfo.userId,
                                       isBusiness: false,
                                       businessID: '',
                                       socialNumber: cryptr.decrypt(doc.influencerInfo.personalIDNumber)
                                   },

                                   seller: {
                                       uniqueId: doc.sellerPersonalInfo._id,
                                       sellerUID: doc.seller.sellerUID,
                                       userId: doc.sellerPersonalInfo.userId,
                                       userName: doc.sellerPersonalInfo.fullName,
                                       businessName: doc.seller.sellerName,
                                       businessID: doc.seller.businessRegistrationNumber,
                                   },

                                   buyer: {
                                       userID: doc.buyer.userId,
                                       userName: doc.buyer.fullName,
                                   },

                                   isCommisionPaidToInfluencer: false,
                                   isSalesFeePaidToSeller: false,
                               };

                               report.revenue.push(obj)
                           });

                           res.json(report)
                       })
                   })

               }
           }else{


               res.json([])
           }
       })


});

router.get('/get/admin/jp/report', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json({revenue: []});
        return;
    }


    let startDate = req.query.startDate;
    let endDate = req.query.endDate;

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let orderCollection = db.collection('ORDER');


    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {$match: {purchaseType: util.FEED_TYPE.JOINT_PURCHASE, status: 1}},
                        {
                            $lookup: {
                                from: 'INFLUENCER',
                                localField: 'influencerId',
                                foreignField: '_id',
                                as: 'influencerInfo'
                            }
                        },
                        {
                            $unwind: '$influencerInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'influencerInfo.uniqueId',
                                foreignField: '_id',
                                as: 'influencerPersonalInfo'
                            }
                        },
                        {
                            $unwind: '$influencerPersonalInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'seller.uniqueId',
                                foreignField: '_id',
                                as: 'sellerPersonalInfo'
                            }
                        },
                        {
                            $unwind: '$sellerPersonalInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'uniqueId',
                                foreignField: '_id',
                                as: 'buyer'
                            }
                        },
                        {
                            $unwind: '$buyer'
                        },
                        {
                            $lookup: {
                                from: 'ORDER',
                                localField: 'orderId',
                                foreignField: '_id',
                                as: 'order'
                            }
                        },
                        {
                            $unwind: {
                                path: '$order'
                            }
                        },
                        {
                            $lookup: {
                                from: 'MATCH_PRODUCT',
                                let: { 'purchasedProductId': '$productId', 'influencerUniqueId': '$influencerPersonalInfo._id' },
                                pipeline: [
                                    {
                                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                                    }
                                ],
                                as: 'match'
                            }
                        },
                        {
                            $unwind: '$match'
                        },
                        {
                            $match: { $and : [{date:{$gte: new Date(startDate) }}, {date: {$lte: new Date(endDate) }}]}
                        }
                    ], (err, cursor) => {
                        if(err){
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){
                                throw e2;
                            }

                            let report = {
                                revenue: []
                            };

                            docs.forEach(doc => {

                                let obj = {
                                    date: doc.date,
                                    orderID: doc.order.orderUID,
                                    saleType: doc.purchaseType,

                                    totalSoldQuantity: doc.orderQuantity,

                                    product: {
                                        currency: doc.orderProduct.currency,
                                        title: doc.orderProduct.title,
                                        sellingPrice: doc.orderProduct.price,
                                        productId: doc.orderProduct.productUID,
                                        option: {
                                            optionName: (doc.orderOption.title === '추가 옵션이 없습니다.') ? '없음' : doc.orderOption.title,
                                            additionalCost: doc.orderOption.priceAddition,
                                        },
                                        discountRate: doc.orderProduct.discountRate,
                                        commissionRate: doc.match.commissionRate,
                                        totalShippingCost: doc.orderProduct.shippingCost,
                                    },

                                    influencer: {
                                        uniqueId: doc.influencerPersonalInfo._id,
                                        firstName: doc.influencerPersonalInfo.fullName,
                                        lastName: '',
                                        fullName: doc.influencerPersonalInfo.fullName,
                                        userUID: doc.influencerPersonalInfo.userUID,
                                        userId: doc.influencerPersonalInfo.userId,
                                        isBusiness: false,
                                        businessID: '',
                                        socialNumber: cryptr.decrypt(doc.influencerInfo.personalIDNumber)
                                    },

                                    seller: {
                                        uniqueId: doc.sellerPersonalInfo._id,
                                        sellerUID: doc.seller.sellerUID,
                                        userId: doc.sellerPersonalInfo.userId,
                                        userName: doc.sellerPersonalInfo.fullName,
                                        businessName: doc.seller.sellerName,
                                        businessID: doc.seller.businessRegistrationNumber,
                                    },

                                    buyer: {
                                        userID: doc.buyer.userId,
                                        userName: doc.buyer.fullName,
                                    },

                                    isCommisionPaidToInfluencer: false,
                                    isSalesFeePaidToSeller: false,
                                };

                                report.revenue.push(obj)
                            });

                            res.json(report)
                        })
                    })



                }
            }else{


                res.json({revenue: []})
            }
        })
});

router.get('/get/admin/promo/report', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json({revenue: []});
        return;
    }


    let startDate = req.query.startDate;
    let endDate = req.query.endDate;

    let db = database.getDb();

    let userCollection = db.collection('USER');
    let cartCollection = db.collection('CART');
    let orderCollection = db.collection('ORDER');


    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {$match: {purchaseType: util.FEED_TYPE.PROMOTION, status: 1}},
                        {
                            $lookup: {
                                from: 'INFLUENCER',
                                localField: 'influencerId',
                                foreignField: '_id',
                                as: 'influencerInfo'
                            }
                        },
                        {
                            $unwind: '$influencerInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'influencerInfo.uniqueId',
                                foreignField: '_id',
                                as: 'influencerPersonalInfo'
                            }
                        },
                        {
                            $unwind: '$influencerPersonalInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'seller.uniqueId',
                                foreignField: '_id',
                                as: 'sellerPersonalInfo'
                            }
                        },
                        {
                            $unwind: '$sellerPersonalInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'uniqueId',
                                foreignField: '_id',
                                as: 'buyer'
                            }
                        },
                        {
                            $unwind: '$buyer'
                        },
                        {
                            $lookup: {
                                from: 'ORDER',
                                localField: 'orderId',
                                foreignField: '_id',
                                as: 'order'
                            }
                        },
                        {
                            $unwind: {
                                path: '$order'
                            }
                        },
                        {
                            $lookup: {
                                from: 'MATCH_PRODUCT',
                                let: { 'purchasedProductId': '$productId', 'influencerUniqueId': '$influencerPersonalInfo._id' },
                                pipeline: [
                                    {
                                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                                    }
                                ],
                                as: 'match'
                            }
                        },
                        {
                            $unwind: '$match'
                        },
                        {
                            $match: { $and : [{date:{$gte: new Date(startDate) }}, {date: {$lte: new Date(endDate) }}]}
                        }
                    ], (err, cursor) => {
                        if(err){
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){
                                throw e2;
                            }

                            let report = {
                                revenue: []
                            };

                            docs.forEach(doc => {

                                let obj = {
                                    date: doc.date,
                                    orderID: doc.order.orderUID,
                                    saleType: doc.purchaseType,

                                    totalSoldQuantity: doc.orderQuantity,

                                    product: {
                                        currency: doc.orderProduct.currency,
                                        title: doc.orderProduct.title,
                                        sellingPrice: doc.orderProduct.price,
                                        productId: doc.orderProduct.productUID,
                                        option: {
                                            optionName: (doc.orderOption.title === '추가 옵션이 없습니다.') ? '없음' : doc.orderOption.title,
                                            additionalCost: doc.orderOption.priceAddition,
                                        },
                                        discountRate: doc.orderProduct.discountRate,
                                        commissionRate: doc.match.commissionRate,
                                        totalShippingCost: doc.orderProduct.shippingCost,
                                    },

                                    influencer: {
                                        uniqueId: doc.influencerPersonalInfo._id,
                                        firstName: doc.influencerPersonalInfo.fullName,
                                        lastName: '',
                                        fullName: doc.influencerPersonalInfo.fullName,
                                        userUID: doc.influencerPersonalInfo.userUID,
                                        userId: doc.influencerPersonalInfo.userId,
                                        isBusiness: false,
                                        businessID: '',
                                        socialNumber: cryptr.decrypt(doc.influencerInfo.personalIDNumber)
                                    },

                                    seller: {
                                        uniqueId: doc.sellerPersonalInfo._id,
                                        sellerUID: doc.seller.sellerUID,
                                        userId: doc.sellerPersonalInfo.userId,
                                        userName: doc.sellerPersonalInfo.fullName,
                                        businessName: doc.seller.sellerName,
                                        businessID: doc.seller.businessRegistrationNumber,
                                    },

                                    buyer: {
                                        userID: doc.buyer.userId,
                                        userName: doc.buyer.fullName,
                                    },

                                    isCommisionPaidToInfluencer: false,
                                    isSalesFeePaidToSeller: false,
                                };

                                report.revenue.push(obj)
                            });

                            res.json(report)
                        })
                    })
                }
            }else{


                res.json({revenue: []})
            }
        })

});

router.get('/get/revenue/all', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let userCollection = db.collection('USER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {
                            $match: {status: 1}
                        }
                    ])

                }
            }else{
                res.json([])
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
})

router.get('/get/revenue/influencer', (req, res) => {
    let uniqueId = req.query.uniqueId

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let userCollection = db.collection('USER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {
                            $match: {status: 1}
                        },
                        {
                            $group: {
                                _id: '$influencerId',
                                order: {$push: {orderId: '$orderId', seller:'$seller', orderProduct: '$orderProduct', orderOption: '$orderOption', orderQuantity: '$orderQuantity'}}

                            }
                        },
                        {
                            $lookup: {
                                from: 'INFLUENCER',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'influencerInfo'
                            }
                        },
                        {
                            $unwind: '$influencerInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'influencerInfo.uniqueId',
                                foreignField: '_id',
                                as: 'influencer'
                            }
                        },
                        {
                            $unwind: '$influencer'
                        },
                        {
                            $lookup: {
                                from:'MATCH_PRODUCT',
                                localField: 'influencer._id',
                                foreignField: 'uniqueId',
                                as: 'matchProduct'
                            }
                        },
                        {
                            $unwind: {
                                path: '$matchProduct',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: '$matchProduct',
                                localField: 'order.orderProduct.productId',
                                foreignField: 'productId',
                                as: 'matchedProduct'
                            }

                        },
                        {
                            $unwind: {
                                path: '$matchedProduct',
                                preserveNullAndEmptyArrays: true
                            }
                        }

                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send();
                            throw err;
                        }

                        cursor.toArray((e2,docs) => {
                            if(e2){
                                throw e2
                            }

                            let list = [];

                            let date = new Date();

                            docs.forEach(doc => {

                                if(doc.matchedProduct !== undefined){
                                    let obj = {
                                        date: date,
                                        influencer: {
                                            uniqueId: doc.influencer._id,
                                            userId: doc.influencer.userId,
                                            firstName: doc.influencer.fullName,
                                            lastName: '',
                                            fullName: doc.influencer.fullName
                                        },
                                        product: {
                                            title: '',
                                            UID: '',
                                            currency: 'KRW'
                                        },
                                        totalAmount: 0,
                                        totalSoldQuantity: 0,
                                        totalPaymentDue: 0
                                    }

                                    let totalAmount = 0;
                                    let currency = '';
                                    let totalPaymentDue = 0;
                                    let totalSoldQuantity = 0;

                                    doc.order.forEach(order => {



                                        let quantity = order.orderQuantity;
                                        let price = order.orderProduct.price;

                                        let optionPrice = 0;

                                        if(order.orderOption.priceAddition !== undefined){
                                            optionPrice = order.orderOption.priceAddition;
                                        }


                                        let discountRate = order.orderProduct.discountRate;
                                        let commissionRate = order.orderProduct.commission;

                                        let amount = (price + optionPrice) * ( 1 - discountRate / 100) * quantity;

                                        let paymentDue = (price + optionPrice) * commissionRate / 100;


                                        totalAmount += amount;
                                        currency = order.orderProduct.currency;
                                        totalSoldQuantity += quantity;

                                        totalPaymentDue += paymentDue
                                    });

                                    obj.totalAmount = totalAmount;
                                    obj.product.currency = currency;
                                    obj.totalPaymentDue = totalPaymentDue;
                                    obj.totalSoldQuantity = totalSoldQuantity;

                                    list.push(obj)
                                }
                            });

                            res.json(list)
                        })


                    })

                }
            }else{
                res.json([])
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
})

router.get('/get/revenue/product', (req, res) => {
    let uniqueId = req.query.uniqueId
    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let userCollection = db.collection('USER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {
                            $match: {status: 1}
                        },
                        {
                            $group: {
                                _id: '$orderProduct._id',
                                order: {$push: {orderId: '$orderId', seller:'$seller', orderProduct: '$orderProduct', orderOption: '$orderOption', orderQuantity: '$orderQuantity'}},
                                influencerId: {$first: '$influencerId'}
                            }
                        },
                        {
                            $lookup: {
                                from: 'INFLUENCER',
                                localField: 'influencerId',
                                foreignField: '_id',
                                as: 'influencerInfo'
                            }
                        },
                        {
                            $unwind: '$influencerInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'influencerInfo.uniqueId',
                                foreignField: '_id',
                                as: 'influencer'
                            }
                        },
                        {
                            $unwind: '$influencer'
                        }
                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send()
                            throw err;
                        }

                        cursor.toArray((e2,docs) => {
                            if(e2){
                                throw e2
                            }

                            let list = [];

                            let date = new Date();

                            docs.forEach(doc => {



                                let obj = {
                                    date: date,
                                    influencer: {
                                        uniqueId: doc.influencer._id,
                                        userId: doc.influencer.userId,
                                        firstName: doc.influencer.fullName,
                                        lastName: '',
                                        fullName: doc.influencer.fullName
                                    },
                                    product: {
                                        currency: ''
                                    },
                                    totalAmount: 0,
                                    totalSoldQuantity: 0,

                                }

                                let totalAmount = 0;
                                let totalSoldQuantity = 0
                                let currency = 'KRW';
                                doc.order.forEach(order => {
                                    let quantity = order.orderQuantity;
                                    let price = order.orderProduct.price;
                                    let optionPrice = 0;

                                    if(order.orderOption.priceAddition !== undefined){
                                        optionPrice = order.orderOption.priceAddition;
                                    }

                                    let discountRate = order.orderProduct.discountRate;

                                    let amount = (price + optionPrice) * ( 1 - discountRate / 100) * quantity

                                    totalAmount += amount;
                                    totalSoldQuantity += quantity;

                                    let product = order.orderProduct;

                                    obj.product.title = product.title
                                    obj.product.UID = product.productUID
                                    currency = order.orderProduct.currency;

                                });

                                obj.totalAmount = totalAmount;
                                obj.totalSoldQuantity = totalSoldQuantity
                                obj.product.currency = currency;

                                list.push(obj)
                            });



                            res.json(list)
                        })


                    })


                }
            }else{
                res.json([])
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});


router.get('/get/influencer/payment/due', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let userCollection = db.collection('USER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {
                            $match: {status: 1}
                        },
                        {
                            $group: {
                                _id: '$influencerId',
                                influencerId: {$first: '$influencerId'},
                                order: {$push: {orderId: '$orderId', seller:'$seller', orderProduct: '$orderProduct', orderOption: '$orderOption', orderQuantity: '$orderQuantity'}}

                            }
                        },

                        {
                            $lookup: {
                                from: 'INFLUENCER',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'influencerInfo'
                            }
                        },
                        {
                            $unwind: '$influencerInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'influencerInfo.uniqueId',
                                foreignField: '_id',
                                as: 'influencer'
                            }
                        },
                        {
                            $unwind: '$influencer'
                        },

                        {
                            $lookup: {
                                from: 'MATCH_PRODUCT',
                                localField: 'order.orderProduct.productId',
                                foreignField: 'productId',
                                as: 'matchedProduct'
                            }

                        },


                        {

                            $project: {
                                order:1,
                                influencerInfo: 1,
                                influencer:1,
                                matchedProduct: 1,
                                isEqual: { $eq: ['$matchedProduct.uniqueId' , '$influencer._id']}

                            }
                        }

                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send();
                            throw err;
                        }

                        cursor.toArray((e2,docs) => {
                            if(e2){
                                throw e2
                            }

                            let list = [];

                            let date = new Date();

                            docs.forEach(doc => {
//ObjectId("5db9565e1808fe78db95625c")
                                if(doc.matchedProduct !== undefined){
                                    let obj = {
                                        date: date,
                                        influencer: {
                                            uniqueId: doc.influencer._id,
                                            userId: doc.influencer.userId,
                                            firstName: doc.influencer.fullName,
                                            lastName: '',
                                            fullName: doc.influencer.fullName
                                        },
                                        product: {
                                            title: '',
                                            UID: '',
                                            currency: 'KRW'
                                        },
                                        totalAmount: 0,
                                        totalSoldQuantity: 0,
                                        totalPaymentDue: 0
                                    }

                                    let totalAmount = 0;
                                    let currency = '';
                                    let totalPaymentDue = 0;
                                    let totalSoldQuantity = 0;

                                    doc.order.forEach(order => {



                                        let quantity = order.orderQuantity;
                                        let price = order.orderProduct.price;

                                        let optionPrice = 0;

                                        if(order.orderOption.priceAddition !== undefined){
                                            optionPrice = order.orderOption.priceAddition;
                                        }


                                        let discountRate = order.orderProduct.discountRate;
                                        let commissionRate = 0;



                                        let filteredArray = doc.matchedProduct.filter(x => x.productId.toString() === order.orderProduct.productId.toString())

                                        if(filteredArray.length > 0){
                                            commissionRate = filteredArray[0].commissionRate
                                        }




                                        let amount = (price + optionPrice) * ( 1 - discountRate / 100) * quantity;

                                        let paymentDue = (price + optionPrice) * commissionRate / 100;


                                        totalAmount += amount;
                                        currency = order.orderProduct.currency;
                                        totalSoldQuantity += quantity;

                                        totalPaymentDue += paymentDue
                                    });

                                    obj.totalAmount = totalAmount;
                                    obj.product.currency = currency;
                                    obj.totalPaymentDue = totalPaymentDue;
                                    obj.totalSoldQuantity = totalSoldQuantity;

                                    list.push(obj)
                                }
                            });

                            res.json(list)
                        })


                    })

                }
            }else{
                res.json([])
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.get('/get/seller/payment/due', (req, res) => {
    let uniqueId = req.query.uniqueId
    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let userCollection = db.collection('USER');

    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){
                //if(user.isAdmin){
                if(true){

                    cartCollection.aggregate([
                        {
                            $match: {status: 1}
                        },
                        {
                            $group: {
                                _id: '$seller._id',
                                order: {$push: {orderId: '$orderId', seller:'$seller', orderProduct: '$orderProduct', orderOption: '$orderOption', orderQuantity: '$orderQuantity'}}

                            }
                        },
                        {
                            $lookup: {
                                from: 'SELLER',
                                localField: 'order.seller._id',
                                foreignField: '_id',
                                as: 'sellerInfo'
                            }
                        },
                        {
                            $unwind: '$sellerInfo'
                        },
                        {
                            $lookup: {
                                from: 'USER',
                                localField: 'sellerInfo.uniqueId',
                                foreignField: '_id',
                                as: 'seller'
                            }
                        },
                        {
                            $unwind: '$seller'
                        }

                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send()
                            throw err;
                        }

                        cursor.toArray((e2,docs) => {
                            if(e2){
                                throw e2
                            }

                            let list = [];

                            let date = new Date();

                            docs.forEach(doc => {


                                let obj = {
                                    date: date,
                                    seller: {
                                        uniqueId: doc.seller._id,
                                        userId: doc.seller.userId,
                                        firstName: doc.seller.fullName,
                                        lastName: '',
                                        fullName: doc.seller.fullName
                                    },
                                    product: {
                                        title: '',
                                        UID: '',
                                        currency: 'KRW'
                                    },
                                    totalAmount: 0,
                                    totalSoldQuantity: 0,
                                    totalPaymentDue: 0,
                                    totalShippingCost: 0
                                }

                                let totalAmount = 0;
                                let currency = '';
                                let totalPaymentDue = 0;
                                let totalSoldQuantity = 0;
                                let totalShippingCost = 0;
                                doc.order.forEach((order, index) => {



                                    let quantity = order.orderQuantity;
                                    let price = order.orderProduct.price;
                                    let optionPrice = 0;

                                    if(order.orderOption.priceAddition !== undefined){
                                        optionPrice = order.orderOption.priceAddition;
                                    }

                                    let discountRate = order.orderProduct.discountRate;


                                    let amount = (price + optionPrice) * ( 1 - discountRate / 100) * quantity;

                                    let paymentDue = (price + optionPrice) * ( 1 - discountRate / 100) * quantity + order.orderProduct.shippingCost;


                                    totalAmount += amount;
                                    currency = order.orderProduct.currency;
                                    totalSoldQuantity += quantity;

                                    totalPaymentDue += paymentDue;
                                    totalShippingCost += order.orderProduct.shippingCost

                                });

                                obj.totalAmount = totalAmount;
                                obj.product.currency = currency;
                                obj.totalPaymentDue = totalPaymentDue;
                                obj.totalSoldQuantity = totalSoldQuantity;
                                obj.totalShippingCost = totalShippingCost;

                                list.push(obj)
                            });

                            res.json(list)
                        })


                    })

                }
            }else{
                res.json([])
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.post('/set/commission', (req, res) => {
    let matchRequestId = req.body.matchRequestId;
    let commissionRate = req.body.commissionRate;

    let db = database.getDb()

    let matchRequestCollection = db.collection('MATCH_PRODUCT')

    matchRequestCollection.updateOne({_id: new objectId(matchRequestId)}, {$set: {commissionRate: parseFloat(commissionRate)}})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.post('/request/cancel/order', (req, res) => {
    let orderId = req.body.orderId;
    let uniqueId = req.body.uniqueId;
    let amount = req.body.amount;
    let cancelMessage = req.body.cancelMessage;
    let partialCancelCode = req.body.partialCancelCode;
    let cartIds = req.body.cartIds;

    let db = database.getDb();

    let orderCollection = db.collection('ORDER');

    orderCollection.findOne({_id: new objectId(orderId)})
        .then(order => {


            let parameters = {
                MID: nicepay.mid,
                TID: order.tid,
                CancelMsg: cartIds,
                CancelAmt: amount.toString(),

                CancelPwd: nicepay.cancelPassword,
                PartialCancelCode: partialCancelCode
            }

            if(order !== null){
                let options = {
                    url: 'https://www.earn-it.co.kr/api/cancel/order',
                    form: {
                        MID: nicepay.mid,
                        TID: order.tid,
                        CancelMsg: cartIds,
                        CancelAmt: amount.toString(),

                        CancelPwd: nicepay.cancelPassword,
                        PartialCancelCode: partialCancelCode
                    }
                };

                request.post(options, (error, response, body) => {
                    console.log(error, response, body)
                })

                res.status(200).send()
            }else{
                res.status(500).send();
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
})


module.exports = router;