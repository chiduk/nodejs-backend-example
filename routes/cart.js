let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
let util = require('../util/constants');
let getUid = require('get-uid');
let request = require('request');
let tracker = require('../config/tracker');

router.post('/delete', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartIds = req.body.cartIds;

    let db = database.getDb();

    let cartCollection = db.collection('CART');

    cartIds.forEach(cartId => {
        cartCollection.deleteOne({_id: new objectId(cartId)})
    })

    res.status(200).send()
});

router.post('/delete/item', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartId = req.body.cartId;

    let db = database.getDb();

    let cartCollection = db.collection('CART');

    cartCollection.deleteOne({_id: new objectId(cartId)})
        .then(result => {
            res.status(200).send()
        })

})

router.post('/add', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let productId = req.body.productId;
    let optionId = req.body.optionId;
    let orderQuantity = req.body.orderQuantity;
    let purchaseType = req.body.purchaseType;
    let influencerUniqueId = req.body.influencerUniqueId; //인플루언서의 user uniqueId * influencerCollection 의 id 아님..

    let db = database.getDb();
    let cartCollection = db.collection('CART');
    let influencerCollection = db.collection('INFLUENCER');

    influencerCollection.findOne({uniqueId: new objectId(influencerUniqueId)})
        .then(influencer => {
            if(influencer !== null){

                let item = {
                    uniqueId: new objectId(uniqueId),
                    productId: new objectId(productId),
                    optionId: new objectId(optionId),
                    purchaseType: purchaseType,
                    influencerId: influencer._id,
                    status: 0,
                    isBuyNow: false
                };

                cartCollection.findOne(item)
                    .then(result => {
                        if(result === null){
                            item.orderQuantity = parseInt(orderQuantity)
                            cartCollection.insertOne(item)
                                .then(result => {
                                    res.status(200).send()
                                })
                                .catch(err => {
                                    logger.error(err);
                                    res.status(500).send();
                                    throw err;
                                })
                        }else{
                            cartCollection.updateOne(item, {$inc: {orderQuantity: parseInt(orderQuantity)}}, {upsert: true})
                                .then(result => {
                                    res.status(200).send()
                                })
                                .catch(err => {
                                    logger.error(err);
                                    res.status(500).send();
                                    throw err;
                                })
                        }
                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })


            }else{
                res.status(500).send()
            }
        })
        .catch(err => {

            res.status(500).send();
            throw err;
        })


});

router.post('/buynow', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let productId = req.body.productId;
    let optionId = req.body.optionId;
    let orderQuantity = req.body.orderQuantity;
    let purchaseType = req.body.purchaseType;
    let influencerUniqueId = req.body.influencerUniqueId; //인플루언서의 user uniqueId * influencerCollection 의 id 아님..

    let db = database.getDb();
    let cartCollection = db.collection('CART');
    let influencerCollection = db.collection('INFLUENCER');
    let productCollection = db.collection('PRODUCT');

    influencerCollection.findOne({uniqueId: new objectId(influencerUniqueId)})
        .then(influencer => {
            if(influencer !== null){

                let item = {
                    uniqueId: new objectId(uniqueId),
                    productId: new objectId(productId),
                    optionId: new objectId(optionId),
                    purchaseType: purchaseType,
                    influencerId: influencer._id,
                    status: 0,
                    orderQuantity: orderQuantity,
                    isBuyNow: true
                };

                cartCollection.insertOne(item)
                    .then(result => {
                        if(result !== null){

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
                                }
                            ], (err, cursor) => {
                                if(err){
                                    res.status(500).send()
                                    throw err;
                                }

                                cursor.toArray((e2, docs) => {
                                    if(e2){
                                        res.status(500).send();
                                        throw e2
                                    }

                                    let seller = {};

                                    docs.forEach(doc => {
                                        let obj = doc;
                                        obj.sellerId = doc._id;
                                        seller = obj
                                    });

                                    res.json({cartId: result.insertedId, seller: seller})
                                })
                            })



                        }else{
                            res.status(500).send()
                        }


                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })


            }else{
                res.status(500).send()
            }
        })
        .catch(err => {

            res.status(500).send();
            throw err;
        })


})

router.get('/get/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.json({count: 0})
        return
    }

    let db = database.getDb();

    let cartCollection = db.collection('CART');

    cartCollection.countDocuments({uniqueId: new objectId(uniqueId) , status: 0, isBuyNow:false })
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {

            res.status(500).send();
            throw err;
        })
})

router.get('/get/items', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.json([])
        return
    }

    let db = database.getDb();

    let cartCollection = db.collection('CART');

    cartCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId), status : 0, isBuyNow: false}
        },
        {
            $lookup: {
                from: 'PRODUCT',
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
                localField:'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }
        },
        {
            $unwind: '$productImages'
        },
        {
            $lookup: {
                from: 'PRODUCT_OPTION',
                localField: 'optionId',
                foreignField: '_id',
                as: 'option'
            }
        },
        {
            $unwind: {
                path: '$option',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'SELLER',
                localField: 'product.sellerId',
                foreignField: '_id',
                as: 'seller'
            }
        },
        {
            $unwind: '$seller'
        },
        {
            $group: {
                _id: '$_id',
                orderQuantity: {$first: '$orderQuantity'},
                option: {$first: '$option'},
                product: {$first: '$product'},
                productImages: {$addToSet: '$productImages'},
                seller: {$first: '$seller'}
            }
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let items = [];

            docs.forEach(doc => {

                let item = {
                    cartId: doc._id,
                    orderQuantity: doc.orderQuantity,
                    product: doc.product,
                    productImages: [],
                    option: [],
                    seller: doc.seller
                }

                if(doc.option !== null){
                    item.option = doc.option
                }

                doc.productImages.forEach(image => {
                    if(image.productImageType === undefined){
                        item.productImages.push(image.filename)
                    }else{
                        if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                            item.productImages.push(image.filename)
                        }

                    }

                });

                item.seller.sellerId = doc.seller._id;

                items.push(item)
            });

            res.json(items)
        })
    })
});

router.post('/order', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartIds = req.body.cartIds;
    let items = JSON.parse(req.body.items);
    let receiverName = req.body.receiverName;
    let address = req.body.address;
    let zonecode = req.body.zonecode;
    let phoneNumber = req.body.phoneNumber;
    let requestMessage = req.body.requestMessage;
    let billingInfoEmail = req.body.billingInfoEmail;

    let billingInfoName = req.body.billingInfoName;
    //
    let billingInfoPhoneNo = req.body.billingInfoPhoneNo;
    // let billingInfoZipcode = req.body.billingInfoZipcode;



    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let orderCollection = db.collection('ORDER');

    items.forEach(item => {
        let cartId = new objectId(item.cartId)

        let orderQuantity = parseInt(item.orderQuantity);
        let orderProduct = item.product;
        let orderOption = item.option;
        let seller = item.seller;

        seller._id = new objectId(item.seller._id);
        seller.sellerId = new objectId(item.seller.sellerId);
        seller.uniqueId = new objectId(item.seller.uniqueId)

        orderProduct._id = new objectId(item.product._id);
        orderProduct.productId = new objectId(item.product._id);

        orderOption._id = new objectId(item.option._id);
        orderOption.productId = new objectId(item.option.productId);

        cartCollection.updateOne({_id: cartId}, {$set: {date: new Date(), shippingStatus: util.SHIPPING_STATUS.PREPARING, orderQuantity: orderQuantity, orderProduct: orderProduct, orderOption: orderOption, seller: seller}}, {upsert: true})
    });



    let obj = {
        orderUID: 'O'+getUid(),
        uniqueId: new objectId(uniqueId),
        cartIds: [],
        date: new Date(),
        receiverName: receiverName,
        address: address,
        zonecode: zonecode,
        phoneNumber: phoneNumber,
        requestMessage: requestMessage,
        status: 0,
        shippingStatus: util.SHIPPING_STATUS.PREPARING,
        trackingNumber: '',
        shippingCoCode: '',
        shippingCoName: '',
        billingInfoEmail: billingInfoEmail,
        billingInfoName: billingInfoName,
        billingInfoPhoneNo: billingInfoPhoneNo
    };

    cartIds.forEach(cartId => {
        obj.cartIds.push(new objectId(cartId))
    });

    orderCollection.insertOne(obj)
        .then(result => {
            let orderId = result.insertedId;
            res.json({orderId: orderId})
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.post('/order/item', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let cartId = req.body.cartId;

    let db = database.getDb();

    let cartCollection = db.collection('CART');
    let orderCollection = db.collection('ORDER');

    let obj = {
        uniqueId: new objectId(uniqueId),
        cartIds: [new objectId(cartId)],
        date: new Date(),
        shippingStatus: util.SHIPPING_STATUS.PREPARING,
        trackingNumber: '',
        shippingCoCode: '',
        shippingCoName: ''
    };



    orderCollection.insertOne(obj)
        .then(result => {
            let orderId = result.insertedId;
            res.json({orderId: orderId})
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
})

router.get('/get/ordered/items', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();


    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.json([])
        return;
    }

    let cartCollection = db.collection('CART');
//5d4803eddefdc4e9955ceeb7
    cartCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId), status: 1}
        },
        {
            $lookup: {
                from: 'PRODUCT',
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'SELLER',
                localField: 'product.sellerId',
                foreignField: '_id',
                as: 'seller'
            }
        },
        {
            $unwind: '$seller'
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
        },
        {
            $lookup: {
                from: 'FEED',
                localField: 'influencer._id',
                foreignField: 'uniqueId',
                as: 'feed'
            }
        },
        {
            $unwind: '$feed'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'feedProduct'
            }
        },


        {
            $lookup: {
                from : 'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'images'
            }
        },
        // {
        //     $lookup: {
        //         from: 'PRODUCT_OPTION',
        //         localField: 'optionId',
        //         foreignField: '_id',
        //         as:'option'
        //
        //     }
        // },
        // {
        //     $unwind: '$option'
        // },
        {
            $lookup: {
                from: 'ORDER',
                localField: '_id',
                foreignField:'cartIds',
                as:'order'
            }
        },
        {
            $unwind: '$order'
        },
        {
            $group: {
                _id: '$_id',
                orderQuantity: {$first: '$orderQuantity'},
                feed: {$push: '$feed'},
                feedProduct: {$first: '$feedProduct'},
                product: {$first: '$product'},
                images: {$addToSet: '$images.filename'},
                option: {$first: '$orderOption'},
                order: {$first: '$order'},
                shippingStatus : {$first: '$shippingStatus'},
                orderStatus: {$first: '$orderStatus'},
                exchangeStatus: {$first: '$exchangeStatus'},
                refundStatus: {$first: '$refundStatus'}
            }

        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField:'feed._id',
                foreignField: 'feedId',
                as: 'feedProduct'

            }
        },
        {
            $unwind: '$feedProduct'
        },

        {
            $match:
                {
                    $expr:
                        { $eq: [ "$feedProduct.productId",  "$product._id" ] }
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

            let items = [];

            docs.forEach(doc => {
                doc.cartId = doc._id;
                doc.product.productId = doc.product._id;
                doc.feedId = doc.feedProduct.feedId;
                doc.order.orderId = doc.order._id;

                if(doc.option.title === '추가 옵션이 없습니다.'){
                    doc.option.title = '없음'
                }

                items.push(doc)
            })

            res.json(items);
        })
    })
});


router.post('/set/item/quantity', (req, res) => {
    let cartId = req.body.cartId;
    let quantity = parseInt(req.body.quantity);

    let db = database.getDb()

    let cartCollection = db.collection('CART');

    cartCollection.updateOne({_id: new objectId(cartId)}, {$set: {orderQuantity: quantity}});

    res.status(200).send()
});

router.get('/has/purchased', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let productId = req.query.productId;

    if(uniqueId === 'null' || uniqueId === 'undefined' ||uniqueId === undefined || uniqueId === null){


        res.json({hasPurchased: false});

        return
    }

    let db = database.getDb();

    let cartCollection = db.collection('CART')

    cartCollection.findOne({uniqueId: new objectId(uniqueId), productId: new objectId(productId)})
        .then(cartItem => {
            if(cartItem === null){
                res.json({hasPurchased: false})
            }else{
                if(cartItem.shippingStatus !== undefined){
                    if(cartItem.shippingStatus === util.SHIPPING_STATUS.RECEIVED){
                        res.json({hasPurchased: true})
                    }else{
                        res.json({hasPurchased: false})
                    }
                }else{
                    res.json({hasPurchased: false})
                }
            }
        })
        .catch(err => {
            res.json({hasPurchased: false})
            throw err;
        })
});

router.post('/track/shipping', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let orderId = req.body.orderId;

    let db = database.getDb();

    let orderCollection = db.collection('ORDER');
    let cartCollection = db.collection('CART');

    orderCollection.findOne({_id: new objectId(orderId)})
        .then(order => {
            if(order !== null){


                let options = {
                    url: 'http://info.sweettracker.co.kr/api/v1/trackingInfo?t_key=' + tracker.key + '&t_code=' + order.shippingCoCode + '&t_invoice=' + order.trackingNumber,
                    headers:{
                        accept: "application/json;charset=UTF-8"
                    }
                };

                request(options, (error, response, body) => {

                    if(error){

                    }else{
                        if(response.statusCode === 200){
                            let result = JSON.parse(body)


                            if(result.completeYN === 'Y'){
                                orderCollection.updateOne({_id: new objectId(orderId)}, {$set: {shippingStatus: util.SHIPPING_STATUS.RECEIVED}})
                                    .then(r2 => {

                                    })
                                    .catch(e2 => {
                                        throw e2;
                                    });

                                order.cartIds.forEach(cartId => {
                                    cartCollection.updateOne({_id: cartId}, {shippingStatus: util.SHIPPING_STATUS.RECEIVED})
                                })
                            }
                        }
                    }

                    res.status(200).send()
                })

            }else{
                res.status(200).send()
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
})



module.exports = router;