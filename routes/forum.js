let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;

router.get('/get/comment/count', (req, res) => {
    let forumId = req.query.forumId;

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');

    forumCollection.aggregate([
        {
            $lookup:{
                from: 'COMMENT_FORUM',
                localField: '_id',
                foreignField: 'forumId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FORUM',
                localField: 'comments._id',
                foreignField: 'commentForumId',
                as:'commentComments'
            }
        },
        {
            $project: {
                commentSize: {$size: '$comments'},
                commentCommentSize: {$size: '$commentComments'}
            }
        },
        {
            $project: {
                totalCount: {$add: ['$commentSize', '$commentCommentSize']}
            }
        },
        {
            $match: {
                _id: new objectId(forumId)
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

            let result = {count: 0};

            docs.forEach(doc => {
                result.count = doc.totalCount
            })

            res.json(result)
        })
    })
});

router.get('/get/like/count', (req, res) => {
   let forumId = req.query.forumId;

   let db = database.getDb();

   let likedForumCollection = db.collection('LIKED_FORUM');

   likedForumCollection.countDocuments({forumId: new objectId(forumId)})
       .then(count => {
           res.json({count: count})
       })
       .catch(err => {
           res.status(500).send()
           throw err;
       })
});

router.get('/getRecent', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let filterHashTag = req.query.filterHashTag;
    let hashTag = req.query.hashTag;

    let matchObj = {}
    let isBlockedObj = {}

    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        matchObj = { }
        isBlockedObj = {$cond: [{$in: [null, '$blockedForumUniqueId']}, false, false ]}

    }

    if(uniqueId !== 'null'){
        matchObj = { uniqueId: new objectId(uniqueId)}
        isBlockedObj = {$cond: [{$in: [new objectId(uniqueId), '$blockedForumUniqueId']}, true, false ]}
    }

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');

    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    savedForumHashTagCollection.aggregate([
        {
            $match: matchObj
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
               throw e2;
           }

           let hashTags = []

           docs.forEach(doc => {
               hashTags.push(doc.hashTag)
           });

           let hashTagMatchObj = {$match: {}};

           if(filterHashTag === 'true'){

               if(hashTag !== null && hashTag !== undefined){
                   hashTagMatchObj = {$match: {hashTags: hashTag}}
               }else{
                   hashTagMatchObj = {$match: {hashTags: {$in: hashTags}}}
               }
           }

           forumCollection.aggregate([
               {
                   $lookup: {
                       from: 'HASH_TAG',
                       localField: '_id',
                       foreignField: 'forumId',
                       as: 'hashTags'
                   }
               },
               {
                   $lookup: {
                       from: 'LIKED_FORUM',
                       localField: '_id',
                       foreignField: 'forumId',
                       as: 'likedForums'
                   }
               },
               {
                   $lookup: {
                       from: 'COMMENT_FORUM',
                       localField: '_id',
                       foreignField: 'forumId',
                       as: 'comments'
                   }
               },
               {
                   $lookup: {
                       from: 'COMMENT_COMMENT_FORUM',
                       localField: 'comments._id',
                       foreignField: 'commentForumId',
                       as: 'commentComments'
                   }

               },
               {
                   $lookup: {
                       from: 'USER',
                       localField: 'uniqueId',
                       foreignField: '_id',
                       as: 'user'
                   }
               },
               {
                   $lookup: {
                       from: 'FORUM_REPORT',
                       localField: '_id',
                       foreignField: 'forumId',
                       as: 'blockedForum'
                   }
               },
               {
                    $unwind: {
                        path: '$blockedForum',
                        preserveNullAndEmptyArrays: true
                    }
               },
               {
                   $group: {
                       _id: '$_id',
                       uniqueId: {$first: '$uniqueId'},
                       title: {$first:'$title'},
                       article: {$first: '$article'},
                       date: {$first: '$date'},
                       user: {$first: '$user'},
                       blockedForumUniqueId: {$addToSet: '$blockedForum.uniqueId'},
                       likedForums: {$addToSet: '$likedForums'},
                       comments: {$addToSet: '$comments'},
                       commentComments: {$addToSet: '$commentComments'},
                       mentionUser: {$first: '$mentionUser'},
                       hashTags: {$addToSet: '$hashTags.hashTag'}
                   }
               },
               {
                   $unwind: '$likedForums'
               },
               {
                   $unwind: '$comments'
               },
               {
                   $unwind: '$commentComments'
               },
               {
                   $unwind: '$hashTags'
               },
               {
                   $unwind: '$user'
               },
               {
                   $project: {
                       uniqueId:1,
                       title: 1,
                       article:1,
                       date: 1,
                       user: 1,
                       mentionUser:1,
                       hashTags:1,
                       blockedForumUniqueId:1,
                       isBlocked: isBlockedObj,
                       numOfLikes: {$size:'$likedForums'},
                       numOfComments: {$size: '$comments'},
                       numOfCommentComments: {$size: '$commentComments'}
                   }
               },
               {
                   $sort: {_id: -1}

               },
               hashTagMatchObj

           ], (err2, cursor2) => {
               if(err2){
                   throw err2;
               }

               cursor2.toArray((e2, docs2) => {
                   if(e2){
                       throw e2;
                   }

                   let forums = [];

                   docs2.forEach(doc2 => {
                       console.log(doc2.blockedForumUniqueId);

                       let obj = {
                           forumId: doc2._id,
                           uniqueId: doc2.uniqueId,
                           title: doc2.title,
                           article: doc2.article,
                           date: doc2.date,
                           user: doc2.user,
                           mentionUser: doc2.mentionUser,
                           hashTags: doc2.hashTags,
                           isBlocked: doc2.isBlocked,
                           numOfLikes: doc2.numOfLikes,
                           numOfComments: doc2.numOfComments + doc2.numOfCommentComments
                       }

                       if(!obj.isBlocked){
                           forums.push(obj);
                       }

                   });

                   res.json(forums);
               })
           })
       })

    });
});

router.get('/getByLike', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let filterHashTag = req.query.filterHashTag;
    let hashTag = req.query.hashTag;

    let matchObj = {}

    if(uniqueId !== 'null'){
        matchObj = { uniqueId: new objectId(uniqueId)}
    }

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');

    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    savedForumHashTagCollection.aggregate([
        {
            $match: matchObj
        },
        {
            $limit: 20
        }
    ], (err, cursor) => {
        if (err) {
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if (e2) {
                throw e2;
            }

            let hashTags = []

            docs.forEach(doc => {
                hashTags.push(doc.hashTag)
            })

            let hashTagMatchObj = {$match: {}};

            if (filterHashTag === 'true') {

                if (hashTag !== null && hashTag !== undefined) {
                    hashTagMatchObj = {$match: {hashTags: hashTag}}
                } else {
                    hashTagMatchObj = {$match: {hashTags: {$in: hashTags}}}
                }


            }

            forumCollection.aggregate([
                {
                    $lookup: {
                        from: 'HASH_TAG',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'hashTags'
                    }
                },
                {
                    $lookup: {
                        from: 'LIKED_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'likedForums'
                    }
                },
                {
                    $lookup: {
                        from: 'COMMENT_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'comments'
                    }
                },
                {
                    $lookup: {
                        from: 'COMMENT_COMMENT_FORUM',
                        localField: 'comments._id',
                        foreignField: 'commentForumId',
                        as: 'commentComments'
                    }

                },
                {
                    $lookup: {
                        from: 'USER',
                        localField: 'uniqueId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $lookup: {
                        from: 'FORUM_REPORT',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'blockedForum'
                    }
                },
                {
                    $unwind: {
                        path: '$blockedForum',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: '$_id',
                        uniqueId: {$first: '$uniqueId'},
                        title: {$first:'$title'},
                        article: {$first: '$article'},
                        date: {$first: '$date'},
                        user: {$first: '$user'},
                        likedForums: {$addToSet: '$likedForums'},
                        blockedForumUniqueId: {$addToSet: '$blockedForum.uniqueId'},
                        comments: {$addToSet: '$comments'},
                        commentComments: {$addToSet: '$commentComments'},
                        mentionUser: {$first: '$mentionUser'},
                        hashTags: {$addToSet: '$hashTags.hashTag'}
                    }
                },
                {
                    $unwind: '$likedForums'
                },
                {
                    $unwind: '$comments'
                },
                {
                    $unwind: '$commentComments'
                },
                {
                    $unwind: '$hashTags'
                },
                {
                    $unwind: '$user'
                },
                {
                    $project: {
                        uniqueId:1,
                        title: 1,
                        article:1,
                        date: 1,
                        user: 1,
                        mentionUser:1,
                        hashTags:1,
                        blockedForumUniqueId:1,
                        isBlocked: {$cond: [{$in: [new objectId(uniqueId), '$blockedForumUniqueId']}, true, false ]},
                        numOfLikes: {$size:'$likedForums'},
                        numOfComments: {$size: '$comments'},
                        numOfCommentComments: {$size: '$commentComments'}
                    }
                },
                {
                    $sort: {numOfLikes: -1}
                },
                hashTagMatchObj

            ], (err2, cursor2) => {
                if(err2){
                    throw err2;
                }

                cursor2.toArray((e3, docs2) => {
                    if(e3){
                        throw e3;
                    }

                    let forums = [];

                    docs2.forEach(doc2 => {
                        let obj = {
                            forumId: doc2._id,
                            uniqueId: doc2.uniqueId,
                            title: doc2.title,
                            article: doc2.article,
                            date: doc2.date,
                            user: doc2.user,
                            mentionUser: doc2.mentionUser,
                            hashTags: doc2.hashTags,
                            isBlocked: doc2.isBlocked,
                            numOfLikes: doc2.numOfLikes,
                            numOfComments: doc2.numOfComments + doc2.numOfCommentComments
                        }

                        if(!obj.isBlocked){
                            forums.push(obj);
                        }

                    })

                    res.json(forums);
                })
            })

        })
    })


});

router.get('/getByComment', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let filterHashTag = req.query.filterHashTag;
    let hashTag = req.query.hashTag;

    let matchObj = {}

    if(uniqueId !== 'null'){
        matchObj = { uniqueId: new objectId(uniqueId)}
    }

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');

    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    savedForumHashTagCollection.aggregate([
        {
            $match: matchObj
        },
        {
            $limit: 20
        }
    ], (err, cursor) => {
        if (err) {
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if (e2) {
                throw e2;
            }

            let hashTags = []

            docs.forEach(doc => {
                hashTags.push(doc.hashTag)
            })

            let hashTagMatchObj = {$match: {}};

            if (filterHashTag === 'true') {

                if (hashTag !== null && hashTag !== undefined) {
                    hashTagMatchObj = {$match: {hashTags: hashTag}}
                } else {
                    hashTagMatchObj = {$match: {hashTags: {$in: hashTags}}}
                }


            }

            forumCollection.aggregate([
                {
                    $lookup: {
                        from: 'HASH_TAG',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'hashTags'
                    }
                },
                {
                    $lookup: {
                        from: 'LIKED_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'likedForums'
                    }
                },
                {
                    $lookup: {
                        from: 'COMMENT_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'comments'
                    }
                },
                {
                    $lookup: {
                        from: 'COMMENT_COMMENT_FORUM',
                        localField: 'comments._id',
                        foreignField: 'commentForumId',
                        as: 'commentComments'
                    }

                },
                {
                    $lookup: {
                        from: 'USER',
                        localField: 'uniqueId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $lookup: {
                        from: 'FORUM_REPORT',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'blockedForum'
                    }
                },
                {
                    $unwind: {
                        path: '$blockedForum',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: '$_id',
                        uniqueId: {$first: '$uniqueId'},
                        title: {$first:'$title'},
                        article: {$first: '$article'},
                        date: {$first: '$date'},
                        user: {$first: '$user'},
                        blockedForumUniqueId: {$addToSet: '$blockedForum.uniqueId'},
                        likedForums: {$addToSet: '$likedForums'},
                        comments: {$addToSet: '$comments'},
                        commentComments: {$addToSet: '$commentComments'},
                        mentionUser: {$first: '$mentionUser'},
                        hashTags: {$addToSet: '$hashTags.hashTag'}
                    }
                },
                {
                    $unwind: '$likedForums'
                },
                {
                    $unwind: '$comments'
                },
                {
                    $unwind: '$commentComments'
                },
                {
                    $unwind: '$hashTags'
                },
                {
                    $unwind: '$user'
                },
                {
                    $project: {
                        uniqueId:1,
                        title: 1,
                        article:1,
                        date: 1,
                        user: 1,
                        mentionUser:1,
                        blockedForumUniqueId:1,
                        hashTags:1,
                        numOfLikes: {$size:'$likedForums'},
                        numOfComments: {$size: '$comments'},
                        numOfCommentComments: {$size: '$commentComments'},
                        commentSum: {$add: ['$numOfComments', '$numOfCommentComments']}
                    }
                },
                {
                    $project: {
                        uniqueId:1,
                        title: 1,
                        article:1,
                        date: 1,
                        user: 1,
                        mentionUser:1,
                        hashTags:1,
                        blockedForumUniqueId:1,
                        isBlocked: {$cond: [{$in: [new objectId(uniqueId), '$blockedForumUniqueId']}, true, false ]},
                        numOfLikes: 1,
                        numOfComments: 1,
                        numOfCommentComments: 1,
                        commentSum: {$add: ['$numOfComments', '$numOfCommentComments']}
                    }
                },
                {
                    $sort: {commentSum: -1}
                },
                hashTagMatchObj

            ], (err2, cursor2) => {
                if(err2){
                    throw err2;
                }

                cursor2.toArray((e3, docs2) => {
                    if(e3){
                        throw e3;
                    }

                    let forums = [];

                    docs2.forEach(doc2 => {
                        let obj = {
                            forumId: doc2._id,
                            uniqueId: doc2.uniqueId,
                            title: doc2.title,
                            article: doc2.article,
                            date: doc2.date,
                            user: doc2.user,
                            mentionUser: doc2.mentionUser,
                            hashTags: doc2.hashTags,
                            isBlocked: doc2.isBlocked,
                            numOfLikes: doc2.numOfLikes,
                            numOfComments: doc2.commentSum
                        }

                        if(!obj.isBlocked){
                            forums.push(obj);
                        }

                    });

                    res.json(forums);
                })
            })

        })
    })


});

router.get('/getByRead', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let filterHashTag = req.query.filterHashTag;
    let hashTag = req.query.hashTag;

    let matchObj = {}

    if(uniqueId !== 'null'){
        matchObj = { uniqueId: new objectId(uniqueId)}
    }


    let db = database.getDb();

    let forumCollection = db.collection('FORUM');

    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    savedForumHashTagCollection.aggregate([
        {
            $match: matchObj
        },
        {
            $limit: 20
        }
    ], (err, cursor) => {
        if (err) {
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if (e2) {
                throw e2;
            }

            let hashTags = []

            docs.forEach(doc => {
                hashTags.push(doc.hashTag)
            })

            let hashTagMatchObj = {$match: {}};

            if (filterHashTag === 'true') {

                if (hashTag !== null && hashTag !== undefined) {
                    hashTagMatchObj = {$match: {hashTags: hashTag}}
                } else {
                    hashTagMatchObj = {$match: {hashTags: {$in: hashTags}}}
                }


            }

            forumCollection.aggregate([
                {
                    $lookup: {
                        from: 'HASH_TAG',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'hashTags'
                    }
                },
                {
                    $lookup: {
                        from: 'LIKED_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'likedForums'
                    }
                },
                {
                    $lookup: {
                        from: 'COMMENT_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'comments'
                    }
                },
                {
                    $lookup: {
                        from: 'COMMENT_COMMENT_FORUM',
                        localField: 'comments._id',
                        foreignField: 'commentForumId',
                        as: 'commentComments'
                    }
                },
                {
                    $lookup: {
                        from: 'READ_FORUM',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'read'
                    }
                },
                {
                    $lookup: {
                        from: 'USER',
                        localField: 'uniqueId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $lookup: {
                        from: 'FORUM_REPORT',
                        localField: '_id',
                        foreignField: 'forumId',
                        as: 'blockedForum'
                    }
                },
                {
                    $unwind: {
                        path: '$blockedForum',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: '$_id',
                        uniqueId: {$first: '$uniqueId'},
                        title: {$first:'$title'},
                        article: {$first: '$article'},
                        date: {$first: '$date'},
                        likedForums: {$addToSet: '$likedForums'},
                        blockedForumUniqueId: {$addToSet: '$blockedForum.uniqueId'},
                        comments: {$addToSet: '$comments'},
                        commentComments: {$addToSet: '$commentComments'},
                        mentionUser: {$first: '$mentionUser'},
                        hashTags: {$addToSet: '$hashTags.hashTag'},
                        read: {$addToSet: '$read'},
                        user: {$first: '$user'}
                    }
                },
                {
                    $unwind: '$likedForums'
                },
                {
                    $unwind: '$comments'
                },
                {
                    $unwind: '$commentComments'
                },
                {
                    $unwind: '$hashTags'
                },
                {
                    $unwind: '$read'
                },
                {
                    $unwind: '$user'
                },
                {
                    $project: {
                        uniqueId:1,
                        title: 1,
                        article:1,
                        date: 1,
                        user: 1,
                        mentionUser:1,
                        hashTags:1,
                        blockedForumUniqueId:1,
                        isBlocked: {$cond: [{$in: [new objectId(uniqueId), '$blockedForumUniqueId']}, true, false ]},
                        numOfLikes: {$size:'$likedForums'},
                        numOfComments: {$size: '$comments'},
                        numOfCommentComments: {$size: '$commentComments'},
                        numOfReads: {$size: '$read'}
                    }
                },
                {
                    $sort: {numOfReads: -1}

                },
                hashTagMatchObj

            ], (err2, cursor2) => {
                if(err2){
                    throw err2;
                }

                cursor2.toArray((e3, docs2) => {
                    if(e3){
                        throw e3;
                    }

                    let forums = [];

                    docs2.forEach(doc2 => {
                        let obj = {
                            forumId: doc2._id,
                            uniqueId: doc2.uniqueId,
                            title: doc2.title,
                            article: doc2.article,
                            date: doc2.date,
                            user: doc2.user,
                            mentionUser: doc2.mentionUser,
                            hashTags: doc2.hashTags,
                            isBlocked: doc2.isBlocked,
                            numOfLikes: doc2.numOfLikes,
                            numOfComments: doc2.numOfComments + doc2.numOfCommentComments,
                            numOfReads: doc2.numOfReads
                        }

                        if(!obj.isBlocked){
                            forums.push(obj);
                        }

                    })

                    res.json(forums);
                })
            })

        })
    })


});

router.post('/read', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let forumId = req.body.forumId;

    let db = database.getDb();

    let readForumCollection = db.collection('READ_FORUM');

    let obj = {
        uniqueId: new objectId(uniqueId),
        forumId: new objectId(forumId)
    }

    readForumCollection.findOne(obj)
        .then(result => {
            if( result === null ){
                obj.date = new Date();
                readForumCollection.insertOne(obj)
                    .then(r => {
                        res.status(200).send()
                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })

            }else{
                res.status(200).send()
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
})

router.post('/add', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let title = req.body.title;
    let article = req.body.article;
    let hashTags = req.body.hashTags;
    let mentionUser = req.body.mentionUser;

    let users = {};
    if(typeof mentionUser !== 'undefined'){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0];


            users[name] = new objectId(user[name])

        });
    }

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');
    let hashTagCollection = db.collection('HASH_TAG');

    let obj = {
        uniqueId: new objectId(uniqueId),
        title: title,
        article: article,
        date: new Date(),
        mentionUser: users
    };

    forumCollection.insertOne(obj)
        .then(result => {
            if (result.result.ok){
                let forumId = result.insertedId;

                res.json({forumId: forumId});

                hashTags.forEach(tag => {
                    let hashTag = {
                        forumId: new objectId(forumId),
                        hashTag: tag
                    };

                    hashTagCollection.insertOne(hashTag)
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

});

router.post('/edit', (req, res) => {
    let forumId = req.body.forumId;
    let uniqueId = req.body.uniqueId;
    let title = req.body.title;
    let article = req.body.article;
    let hashTags = JSON.parse(req.body.hashTags);
    let mentionUser = req.body.mentionUser;

    let users = {};

    if(mentionUser !== undefined){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0];


            users[name] = new objectId(user[name])

        });
    }


    let db = database.getDb();

    let forumCollection = db.collection('FORUM');
    let hashTagCollection = db.collection('HASH_TAG');

    let obj = {

        title: title,
        article: article,

        mentionUser: users
    };

    forumCollection.updateOne({_id: new objectId(forumId), uniqueId: new objectId(uniqueId)}, {$set: obj}, {upsert: true})
        .then(result => {
            if (result.result.ok){


                hashTagCollection.deleteMany({forumId: new objectId(forumId)})
                    .then(result => {
                        hashTags.forEach(tag => {
                            let hashTag = {
                                forumId: new objectId(forumId),
                                hashTag: tag
                            };

                            hashTagCollection.insertOne(hashTag)
                        });

                    })


                res.status(200).send();
            }else{
                res.status(500).send()
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/report', (req, res) => {
    let forumId = req.body.forumId;
    let uniqueId = req.body.uniqueId;
    let report = req.body.report;


    let db = database.getDb();

    let forumCollection = db.collection('FORUM');
    let forumReportCollection = db.collection('FORUM_REPORT');

    let obj = {

        forumId: new objectId(forumId),
        uniqueId: new objectId(uniqueId),
        report: report
    };

    forumReportCollection.insertOne(obj)
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.post('/delete', (req, res) => {
    let forumId = req.body.forumId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');
    let hashTagCollection = db.collection('HASH_TAG');
    let userCollection = db.collection('USER');
    let commentForumCollection = db.collection('COMMENT_FORUM');
    let commentCommentForumCollection = db.collection('COMMENT_COMMENT_FORUM');



    forumCollection.findOne({_id: new objectId(forumId)})
        .then(forum => {
            if(forum !== null){

                userCollection.findOne({_id: new objectId(uniqueId)})
                    .then(user => {
                        if(user !== null){
                            if(user.isAdmin || user._id.toString() === forum.uniqueId.toString()){

                                forumCollection.deleteOne({_id: new objectId(forumId)})
                                    .then(result => {

                                        hashTagCollection.deleteMany({forumId: new objectId(forumId)});


                                        commentForumCollection.find({forumId: new objectId(forumId)})
                                            .toArray((e2, docs) => {
                                                docs.forEach(comment => {
                                                    if(comment !== null){
                                                        let commentForumId = comment._id;

                                                        commentCommentForumCollection.deleteMany({commentForumId: commentForumId})
                                                    }
                                                })
                                            });

                                        commentForumCollection.deleteMany({forumId: new objectId(forumId)});

                                        res.status(200).send();
                                    })
                                    .catch(err => {

                                        res.status(500).send();
                                        throw err;
                                    })

                            }
                        }
                    })
                    .catch(err => {
                        res.status(500).send();
                        throw err;
                    })

            }

            res.status(200).send();

        })
        .catch(err => {

            res.status(500).send();
            throw err;
        });


});

router.post('/like', (req, res) => {
    let forumId = req.body.forumId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();

    let likedForumCollection = db.collection('LIKED_FORUM');

    let obj = {
        uniqueId: new objectId(uniqueId),
        forumId: new objectId(forumId)
    }

    likedForumCollection.findOne(obj)
        .then(result => {
            if(result === null){
                likedForumCollection.insertOne(obj)
                    .then(result => {
                        res.status(200).send();
                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })
            }

            res.status(200).send();
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })


});

router.post('/unlike', (req, res) => {
    let forumId = req.body.forumId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();

    let likedForumCollection = db.collection('LIKED_FORUM');

    let obj = {
        uniqueId: new objectId(uniqueId),
        forumId: new objectId(forumId)
    }

    likedForumCollection.deleteOne(obj)
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })

});

router.get('/isLiked', (req, res) => {
    let forumId = req.query.forumId;
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json({isLiked: false})
        return

    }

    let db = database.getDb();

    let likedForumCollection = db.collection('LIKED_FORUM');

    let obj = {
        uniqueId: new objectId(uniqueId),
        forumId: new objectId(forumId)
    }

    likedForumCollection.findOne(obj)
        .then(result => {
            if(result === null){
                res.json({isLiked: false});
            }else{
                res.json({isLiked: true});
            }


        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
})

router.post('/comment/add', (req, res) => {
    let forumId = req.body.forumId;
    let uniqueId = req.body.uniqueId;
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;
    let lastCommentForumId = req.body.lastCommentForumId;

    let users = {};

    if(typeof mentionUser !== 'undefined'){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0];


            users[name] = new objectId(user[name])

        });
    }

    let db = database.getDb();

    let commentForumCollection = db.collection('COMMENT_FORUM');

    let obj = {
        forumId: new objectId(forumId),
        uniqueId: new objectId(uniqueId),
        comment: comment,
        date: new Date(),
        mentionUser: users
    }

    commentForumCollection.insertOne(obj)
        .then(result => {

            if(lastCommentForumId !== null){
                commentForumCollection.aggregate([
                    {
                        $match:
                            {$and: [ { _id: {$gt: new objectId(lastCommentForumId) }}, {_id: {$lte: result.insertedId}}]}
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

                        docs.forEach(doc => {
                            let user = doc.user;
                            user.uniqueId = doc.user._id;
                            let comment = {
                                commentForumId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: user
                            }

                            comments.push(comment)
                        })

                        res.json(comments)
                    })
                })
            }else{
                commentForumCollection.aggregate([
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

                        docs.forEach(doc => {
                            let user = doc.user;
                            user.uniqueId = doc.user._id;
                            let comment = {
                                commentForumId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: user
                            }

                            comments.push(comment)
                        })

                        res.json(comments)
                    })
                })
            }


        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/comment/edit', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let commentId = req.body.commentId;
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;

    let users = {};
    mentionUser.forEach(user => {
        let name = Object.keys(user)[0];


        users[name] = new objectId(user[name])
    });

    let db = database.getDb();

    let commentForumCollection = db.collection('COMMENT_FORUM');

    commentForumCollection.updateOne({_id: new objectId(commentId), uniqueId: new objectId(uniqueId)}, {$set: {comment: comment, mentionUser: mentionUser}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err);
            res.status(500).json();
            throw err;
        })

});

router.post('/comment/delete', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let commentId = req.body.commentId;

    let db = database.getDb();

    let commentForumCollection = db.collection('COMMENT_FORUM');

    commentForumCollection.deleteOne({_id: new objectId(commentId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/comment/comment/get', (req, res) => {
    let commentForumId = req.query.commentForumId;

    let db = database.getDb();

    let commentCommentForumCollection = db.collection('COMMENT_COMMENT_FORUM');

    commentCommentForumCollection.aggregate([
        {
            $match: { commentForumId: new objectId(commentForumId)}
        },
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
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2
            }

            let replies = [];

            docs.forEach(doc => {
                let user = doc.user;
                user.uniqueId = doc.user._id;

                let reply = {
                    commentCommentForumId: doc._id,
                    comment: doc.comment,
                    user: user,
                    mentionUsers: doc.mentionUsers
                }

                replies.push(reply)
            })

            res.json(replies)
        })
    })
});

router.post('/comment/comment/add', (req, res) => {
    let commentId = req.body.commentId;
    let uniqueId = req.body.uniqueId;
    let comment = req.body.comment;
    let commentForumId = req.body.commentForumId;
    let lastCommentCommentForumId = req.body.lastCommentCommentForumId;

    let mentionUser = req.body.mentionUser;

    let users = {};

    if(mentionUser !== undefined){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0];


            users[name] = new objectId(user[name])

        });
    }


    let db = database.getDb();

    let commentCommentForumCollection = db.collection('COMMENT_COMMENT_FORUM');

    let obj = {
        commentId: new objectId(commentId),
        commentForumId: new objectId(commentForumId),
        uniqueId: new objectId(uniqueId),
        comment: comment,
        date: new Date(),
        mentionUser: users
    }

    commentCommentForumCollection.insertOne(obj)
        .then(result => {

            if(lastCommentCommentForumId !== null && lastCommentCommentForumId !== undefined){
                commentCommentForumCollection.aggregate([
                    {
                        $match:
                            {$and: [ { _id: {$gt: new objectId(lastCommentCommentForumId) }}, {_id: {$lte: result.insertedId}}]}
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
                            let user = doc.user;
                            user.uniqueId = doc.user._id;
                            let obj = {
                                commentCommentForumId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: user
                            }

                            comments.push(obj)
                        })

                        res.json(comments)
                    })
                })
            }else{
                commentCommentForumCollection.aggregate([
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
                            let user = doc.user;
                            user.uniqueId = doc.user._id;

                            let obj = {
                                commentCommentForumId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: user
                            }

                            comments.push(obj)
                        })

                        res.json(comments)
                    })
                })
            }

        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/comment/comment/edit', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let commentCommentId = req.body.commentCommentId;
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;

    let db = database.getDb();

    let commentCommentForumCollection = db.collection('COMMENT_COMMENT_FORUM');

    commentCommentForumCollection.updateOne({_id: new objectId(commentCommentId), uniqueId: new objectId(uniqueId)}, {$set: {comment: comment, mentionUser: mentionUser}}, {upsert: true})
        .then(result => {
            if(result.ok){
                res.status(200).send()
            }else{
                res.status(500).send()
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/comment/comment/delete', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let commentCommentId = req.body.commentCommentId;

    let db = database.getDb();

    let commentCommentForumCollection = db.collection('COMMENT_COMMENT_FORUM');

    commentCommentForumCollection.deleteOne({_id: new objectId(commentCommentId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            res.status(500).send();
        })
});

router.get('/comment/get', (req, res) => {
    let forumId = req.query.forumId;

    let db = database.getDb();

    let forumCommentCollection = db.collection('COMMENT_FORUM');

    forumCommentCollection.aggregate([
        {
            $match: {forumId: new objectId(forumId)}
        },
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

            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw err;
            }

            let comments = [];

            docs.forEach(doc => {
                let user = doc.user;
                user.uniqueId = doc.user._id;


                let comment = {
                    commentForumId: doc._id,
                    uniqueId: doc.uniqueId,
                    comment: doc.comment,
                    user: user
                }

                comments.push(comment)
            })

            res.json(comments)
        })
    })
});

router.post('/save/hashTag', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTag = req.body.hashTag;

    let db = database.getDb();

    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    let obj = {
        uniqueId: new objectId(uniqueId),
        hashTag: hashTag
    }

    savedForumHashTagCollection.findOne(obj)
        .then(result => {
            if(result === null){
                savedForumHashTagCollection.insertOne(obj)
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
    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    let obj = {
        uniqueId: new objectId(uniqueId),
        hashTag: hashTag
    }

    savedForumHashTagCollection.deleteOne(obj)
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
    let savedForumHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');

    savedForumHashTagCollection.aggregate([
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

router.get('/get/suggestedHashTag', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json([]);
        return
    }

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');
    let forumSavedHashTagCollection = db.collection('FORUM_SAVED_HASH_TAG');


    forumCollection.aggregate([
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
                foreignField: 'forumId',
                as: 'hashTags'
            }
        },
        {
            $unwind: '$hashTags'
        },
        {
            $group: {
                _id: '$hashTags.hashTag',
                forums: {$addToSet:'$_id'}
            }
        },
        {
            $project: {
                _id: 1,
                count: {$size: '$forums'}
            }
        },
        {
            $sort: {count: -1}
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
                let obj = {
                    hashTag: doc._id,
                    count: doc.count
                }

                hashTags.push(obj)
            });


            forumSavedHashTagCollection.aggregate([
                {
                    $match: {
                        uniqueId: new objectId(uniqueId)
                    }
                }
            ], (err2, cursor2) => {
                if(err2){
                    throw err2
                }

                cursor2.toArray((e3, docs2) => {
                    if(e3){
                        throw e3;
                    }


                    let savedHashTags = [];

                    docs2.forEach(doc2 => {
                        savedHashTags.push(doc2.hashTag)
                    })

                    let results = [];

                    hashTags.forEach(tag => {
                        let index = savedHashTags.indexOf(tag.hashTag);

                        if( index === -1){

                            results.push(tag)
                        }
                    });

                    res.json(results)
                })
            });



        })
    })

});

module.exports = router;
