let filepath = require('../config/filepath');

module.exports = {
    FEED_TYPE : {
        JOINT_PURCHASE: 'JOINT_PURCHASE',
        PROMOTION: 'PROMOTION'
    },

    PRODUCT_IMAGE_TYPE: {
        PRODUCT: 'PRODUCT',
        DESCRIPTION: 'DESCRIPTION'
    },
    FEED_ADDITIONAL_CONTENTS_TYPE: {
        IMAGE: 'IMAGE',
        SUBTITLE: 'SUBTITLE',
        DESCRIPTION: 'DESCRIPTION',
        URL: 'URL'
    },

    SEARCH_USER_TYPE : {
        ALL: 'ALL',
        INFLUENCER: 'INFLUENCER',
        SELLER: 'SELLER',
        BUYER: 'BUYER'
    },

    NOTIFICATION_TYPE: {
        FEED_COMMENT: 'FEED_COMMENT',
        PRODUCT_COMMENT: 'PRODUCT_COMMENT',
        MATCH_REQUEST: 'MATCH_REQUEST',
        MATCH_REQUEST_SENT: 'MATCH_REQUEST_SENT',
        MATCH_REQUEST_CANCEL: 'MATCH_REQUEST_CANCEL',
        MATCH_REQUEST_CONFIRM: 'MATCH_REQUEST_CONFIRM',
        MATCH_REQUEST_COMMENT: 'MATCH_REQUEST_COMMENT'
    },

    ORDER_STATUS: {
        WAITING_FOR_CONFIRMATION: 'WAITING_FOR_CONFIRMATION',
        CONFIRMED: 'CONFIRMED',
        PACKING: 'PACKING',
        SHIPPED: 'SHIPPED',
        DELIVERING: 'DELIVERING',
        RECEIVED: 'RECEIVED',
        REJECTED_BY_SELLER: 'REJECTED_BY_SELLER', //판매자가 거부
        CANCEL: {
            REQUESTED: 'CANCEL_REQUESTED_BY_BUYER',
            CONFIRMED: 'CANCEL_REQUEST_CONFIRMED',
            DENIED: 'CANCEL_REQUEST_DENIED'
        },
        REFUND: {
            REQUESTED: 'REFUND_REQUESTED_BY_BUYER',
            CONFIRMED: 'REFUND_REQUEST_CONFIRMED',
            DENIED: 'REFUND_REQUEST_DENIED'
        },
        EXCHANGE: {
            REQUESTED: 'EXCHANGE_REQUESTED_BY_BUYER',
            CONFIRMED: 'EXCHANGE_REQUEST_CONFIRMED',
            DENIED: 'EXCHANGE_REQUEST_DENIED'
        }
    },

    REFUND_STATUS: {
        REQUESTED: 'REFUND_REQUESTED_BY_BUYER',
        CONFIRMED: 'REFUND_REQUEST_CONFIRMED',
        DENIED: 'REFUND_REQUEST_DENIED'
    },

    EXCHANGE_STATUS: {
        REQUESTED: 'EXCHANGE_REQUESTED_BY_BUYER',
        CONFIRMED: 'EXCHANGE_REQUEST_CONFIRMED',
        DENIED: 'EXCHANGE_REQUEST_DENIED'
    },

    SHIPPING_STATUS: {
        PREPARING: 'PREPARING',
        PACKING: 'PACKING',
        SHIPPED: 'SHIPPED',
        DELIVERING: 'DELIVERING',
        RECEIVED: 'RECEIVED'
    },

    PURCHASE_PAY_STATUS: {
        WAITING: 'WAITING', // 입금 대기중,
        PAID: 'PAID', //결제 완료,
        CANCEL: 'CANCEL', //취소됨
        REFUND: 'REFUND' //환불됨
    },

    FILE_PATH: {
        PRODUCT: filepath.product.detail,
        PRODUCT_DESC: filepath.product.description,
        FEED: filepath.feed,
        PROFILE: filepath.profile
    },

    PROFILE_SOCIAL_VIEW_MODE: {
        VIEW_ALL: 'ALL',
        VIEW_FOR_SALE: 'FOR_SALE'
    },

    NICEPAY_COMMISSION: 0,

    JOINT_PURCHASE_FEED_LIMIT_COUNT: 10,
    PROMOTION_FEED_LIMIT_COUNT: 5,

    SHIPPING_COMPANY: [
        { Code: '04', Name: 'CJ대한통운' },
        { Code: '05', Name: '한진택배' },
        { Code: '08', Name: '롯데택배' },
        { Code: '01', Name: '우체국택배' },
        { Code: '06', Name: '로젠택배' },
        { Code: '11', Name: '일양로지스' },
        { Code: '12', Name: 'EMS' },
        { Code: '13', Name: 'DHL' },
        { Code: '20', Name: '한덱스' },
        { Code: '21', Name: 'FedEx' },
        { Code: '14', Name: 'UPS' },
        { Code: '26', Name: 'USPS' },
        { Code: '22', Name: '대신택배' },
        { Code: '23', Name: '경동택배' },
        { Code: '32', Name: '합동택배' },
        { Code: '46', Name: 'CU 편의점택배' },
        { Code: '24', Name: 'CVSnet 편의점택배' },
        { Code: '25', Name: 'TNT Express' },
        { Code: '16', Name: '한의사랑택배' },
        { Code: '17', Name: '천일택배' },
        { Code: '18', Name: '건영택배' },
        { Code: '28', Name: 'GSMNtoN' },
        { Code: '29', Name: '에어보이익스프레스' },
        { Code: '30', Name: 'KGL네트웍스' },
        { Code: '33', Name: 'DHL Global Mail' },
        { Code: '34', Name: 'i-Parcel' },
        { Code: '37', Name: '판토스' },
        { Code: '38', Name: 'ECMS Express' },
        { Code: '40', Name: '굿투럭' },
        { Code: '41', Name: 'GSI Express' },
        { Code: '42', Name: 'CJ대한통운 국제특송' },
        { Code: '43', Name: '애니트랙' },
        { Code: '44', Name: '로지스링크(SLX택배)' },
        { Code: '45', Name: '호남택배' },
        { Code: '47', Name: '우리한방택배' },
        { Code: '48', Name: 'ACI Express' },
        { Code: '49', Name: 'ACE Express' },
        { Code: '50', Name: 'GPS Logix' },
        { Code: '51', Name: '성원글로벌카고' },
        { Code: '52', Name: '세방' },
        { Code: '53', Name: '농협택배' },
        { Code: '54', Name: '홈픽택배' },
        { Code: '55', Name: 'EuroParcel' },
        { Code: '56', Name: 'KGB택배' },
        { Code: '57', Name: 'Cway Express' },
        { Code: '58', Name: '하이택배' },
        { Code: '59', Name: '지오로직' },
        { Code: '60', Name: 'YJS글로벌(영국)' },
        { Code: '61', Name: '워펙스코리아' },
        { Code: '62', Name: '(주)홈이노베이션로지스' },
        { Code: '63', Name: '은하쉬핑' },
        { Code: '64', Name: 'FLF퍼레버택배' },
        { Code: '65', Name: 'YJS글로벌(월드)' },
        { Code: '66', Name: 'Giant Network Group' },
        { Code: '67', Name: '디디로지스' },
        { Code: '68', Name: '우리동네택배' },
        { Code: '69', Name: '대림통운' },
        { Code: '70', Name: 'LOTOS CORPORATION' },
        { Code: '71', Name: 'IK물류' },
        { Code: '99', Name: '롯데택배 해외특송' }
    ],

    BANK: [
        {
            "code": "1",
            "name": "한국은행"
        },
        {
            "code": "2",
            "name": "산업은행"
        },
        {
            "code": "3",
            "name": "기업은행"
        },
        {
            "code": "4",
            "name": "국민은행"
        },
        {
            "code": "7",
            "name": "수협은행"
        },
        {
            "code": "8",
            "name": "수출입은행"
        },
        {
            "code": "11",
            "name": "농협은행"
        },
        {
            "code": "12",
            "name": "지역농․축협"
        },
        {
            "code": "20",
            "name": "우리은행"
        },
        {
            "code": "23",
            "name": "SC제일은행"
        },
        {
            "code": "27",
            "name": "한국씨티은행"
        },
        {
            "code": "31",
            "name": "대구은행"
        },
        {
            "code": "32",
            "name": "부산은행"
        },
        {
            "code": "34",
            "name": "광주은행"
        },
        {
            "code": "35",
            "name": "제주은행"
        },
        {
            "code": "37",
            "name": "전북은행"
        },
        {
            "code": "39",
            "name": "경남은행"
        },
        {
            "code": "41",
            "name": "우리카드"
        },
        {
            "code": "44",
            "name": "외환카드"
        },
        {
            "code": "45",
            "name": "새마을금고중앙회"
        },
        {
            "code": "48",
            "name": "신협"
        },
        {
            "code": "50",
            "name": "저축은행"
        },
        {
            "code": "52",
            "name": "모건스탠리은행"
        },
        {
            "code": "54",
            "name": "HSBC은행"
        },
        {
            "code": "55",
            "name": "도이치은행"
        },
        {
            "code": "57",
            "name": "제이피모간체이스은행"
        },
        {
            "code": "58",
            "name": "미즈호은행"
        },
        {
            "code": "59",
            "name": "엠유에프지은행"
        },
        {
            "code": "60",
            "name": "BOA은행"
        },
        {
            "code": "61",
            "name": "비엔피파리바은행"
        },
        {
            "code": "62",
            "name": "중국공상은행"
        },
        {
            "code": "63",
            "name": "중국은행"
        },
        {
            "code": "64",
            "name": "산림조합중앙회"
        },
        {
            "code": "65",
            "name": "대화은행"
        },
        {
            "code": "66",
            "name": "교통은행"
        },
        {
            "code": "67",
            "name": "중국건설은행"
        },
        {
            "code": "71",
            "name": "우체국"
        },
        {
            "code": "76",
            "name": "신용보증기금"
        },
        {
            "code": "77",
            "name": "기술보증기금"
        },
        {
            "code": "81",
            "name": "KEB하나은행"
        },
        {
            "code": "88",
            "name": "신한은행"
        },
        {
            "code": "89",
            "name": "케이뱅크"
        },
        {
            "code": "90",
            "name": "카카오뱅크"
        },
        {
            "code": "101",
            "name": "한국신용정보원"
        },
        {
            "code": "102",
            "name": "대신저축은행"
        },
        {
            "code": "103",
            "name": "에스비아이저축은행"
        },
        {
            "code": "104",
            "name": "에이치케이저축은행"
        },
        {
            "code": "105",
            "name": "웰컴저축은행"
        },
        {
            "code": "106",
            "name": "신한저축은행"
        },
        {
            "code": "209",
            "name": "유안타증권"
        },
        {
            "code": "218",
            "name": "KB증권"
        },
        {
            "code": "221",
            "name": "상상인증권"
        },
        {
            "code": "222",
            "name": "한양증권"
        },
        {
            "code": "223",
            "name": "리딩투자증권"
        },
        {
            "code": "224",
            "name": "BNK투자증권"
        },
        {
            "code": "225",
            "name": "IBK투자증권"
        },
        {
            "code": "227",
            "name": "KTB투자증권"
        },
        {
            "code": "238",
            "name": "미래에셋대우"
        },
        {
            "code": "240",
            "name": "삼성증권"
        },
        {
            "code": "243",
            "name": "한국투자증권"
        },
        {
            "code": "247",
            "name": "NH투자증권"
        },
        {
            "code": "261",
            "name": "교보증권"
        },
        {
            "code": "262",
            "name": "하이투자증권"
        },
        {
            "code": "263",
            "name": "현대차증권"
        },
        {
            "code": "264",
            "name": "키움증권"
        },
        {
            "code": "265",
            "name": "이베스트투자증권"
        },
        {
            "code": "266",
            "name": "SK증권"
        },
        {
            "code": "267",
            "name": "대신증권"
        },
        {
            "code": "269",
            "name": "한화투자증권"
        },
        {
            "code": "270",
            "name": "하나금융투자"
        },
        {
            "code": "278",
            "name": "신한금융투자"
        },
        {
            "code": "279",
            "name": "DB금융투자"
        },
        {
            "code": "280",
            "name": "유진투자증권"
        },
        {
            "code": "287",
            "name": "메리츠종합금융증권"
        },
        {
            "code": "288",
            "name": "바로투자증권"
        },
        {
            "code": "290",
            "name": "부국증권"
        },
        {
            "code": "291",
            "name": "신영증권"
        },
        {
            "code": "292",
            "name": "케이프투자증권"
        },
        {
            "code": "293",
            "name": "한국증권금융"
        },
        {
            "code": "294",
            "name": "한국포스증권"
        },
        {
            "code": "295",
            "name": "우리종합금융"
        },
        {
            "code": "299",
            "name": "아주캐피탈"
        },
        {
            "code": "361",
            "name": "BC카드"
        },
        {
            "code": "364",
            "name": "광주카드"
        },
        {
            "code": "365",
            "name": "삼성카드"
        },
        {
            "code": "366",
            "name": "신한카드"
        },
        {
            "code": "367",
            "name": "현대카드"
        },
        {
            "code": "368",
            "name": "롯데카드"
        },
        {
            "code": "369",
            "name": "수협카드"
        },
        {
            "code": "370",
            "name": "씨티카드"
        },
        {
            "code": "371",
            "name": "NH카드"
        },
        {
            "code": "372",
            "name": "전북카드"
        },
        {
            "code": "373",
            "name": "제주카드"
        },
        {
            "code": "374",
            "name": "하나SK카드"
        },
        {
            "code": "381",
            "name": "KB국민카드"
        },
        {
            "code": "431",
            "name": "미래에셋생명"
        },
        {
            "code": "432",
            "name": "한화생명"
        },
        {
            "code": "433",
            "name": "교보라이프플래닛생명"
        },
        {
            "code": "434",
            "name": "푸본현대생명"
        },
        {
            "code": "435",
            "name": "라이나생명"
        },
        {
            "code": "436",
            "name": "교보생명"
        },
        {
            "code": "437",
            "name": "에이비엘생명"
        },
        {
            "code": "438",
            "name": "신한생명"
        },
        {
            "code": "439",
            "name": "KB생명보험"
        },
        {
            "code": "440",
            "name": "농협생명"
        },
        {
            "code": "441",
            "name": "삼성화재"
        },
        {
            "code": "442",
            "name": "현대해상"
        },
        {
            "code": "443",
            "name": "DB손해보험"
        },
        {
            "code": "444",
            "name": "KB손해보험"
        },
        {
            "code": "445",
            "name": "롯데손해보험"
        },
        {
            "code": "446",
            "name": "오렌지라이프생명보험"
        },
        {
            "code": "447",
            "name": "악사손해보험"
        },
        {
            "code": "448",
            "name": "메리츠화재"
        },
        {
            "code": "449",
            "name": "농협손해보험"
        },
        {
            "code": "450",
            "name": "푸르덴셜생명보험"
        },
        {
            "code": "452",
            "name": "삼성생명"
        },
        {
            "code": "453",
            "name": "흥국생명"
        },
        {
            "code": "454",
            "name": "한화손해보험"
        },
        {
            "code": "455",
            "name": "AIA생명보험"
        },
        {
            "code": "456",
            "name": "DGB생명보험"
        },
        {
            "code": "457",
            "name": "DB생명보험"
        },
        {
            "code": "458",
            "name": "KDB생명보험"
        }
    ]

};