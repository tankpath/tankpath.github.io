export const SE = {
    CANCEL:       'SE_Cancel',
    DECISION:     'SE_Decision',
    DESTROY_TANK: 'SE_DestroyTank',
    EXPLODE:      'SE_Explode',
    FIRE_CB:      'SE_Fire_CB',
    FIRE_SP:      'SE_Fire_SP',
    FIRE_SP_HV:   'SE_Fire_SPhv',
    PLACE_MINE:   'SE_PlaceMine',
    TANK_RUN:     'SE_TankRun',
    WINNER:       'SE_Winner',
    RETRY:        'SE_Retry',
    LOSER:        'SE_Loser',
    COUNT_UP:     'SE_CountUp',
    COUNT_DOWN:   'SE_CountDown',
} as const;
export type SEKey = typeof SE[keyof typeof SE];

export const BGM = {
    INTRO:                 'BGM_Intro',
    BATTLE_01:             'BGM_Battle_01',
    TRY_COUNT_UP:          'BGM_TryCountUp',
    STAGE_LOADING:         'BGM_StageLoading',
    STAGE_LOADING_INTRO:   'BGM_StageLoading_Intro',
    TITLE:                 'BGM_Title',
} as const;
export type BGMKey = typeof BGM[keyof typeof BGM];

export const SE_LIST: { key: SEKey; url: string }[] = [
    { key: SE.CANCEL,       url: '/assets/se/SE_Cancel.wav'     },
    { key: SE.DECISION,     url: '/assets/se/SE_Decision.wav'   },
    { key: SE.DESTROY_TANK, url: '/assets/se/SE_DestroyTank.wav'},
    { key: SE.EXPLODE,      url: '/assets/se/SE_Explode.wav'    },
    { key: SE.FIRE_CB,      url: '/assets/se/SE_Fire_CB.wav'    },
    { key: SE.FIRE_SP,      url: '/assets/se/SE_Fire_SP.wav'    },
    { key: SE.FIRE_SP_HV,   url: '/assets/se/SE_Fire_SPhv.wav' },
    { key: SE.PLACE_MINE,   url: '/assets/se/SE_PlaceMine.wav'  },
    { key: SE.TANK_RUN,     url: '/assets/se/SE_TankRun.wav'    },
    { key: SE.WINNER,       url: '/assets/se/SE_Winner.wav'     },
    { key: SE.RETRY,        url: '/assets/se/SE_Retry.wav'      },
    { key: SE.LOSER,        url: '/assets/se/SE_Loser.wav'      },
    { key: SE.COUNT_UP,     url: '/assets/se/SE_CountUp.wav'    },
    { key: SE.COUNT_DOWN,   url: '/assets/se/SE_CountDown.wav'  },
];

export const BGM_LIST: { key: BGMKey; url: string }[] = [
    { key: BGM.INTRO,               url: '/assets/bgm/BGM_Intro.mp3'               },
    { key: BGM.BATTLE_01,           url: '/assets/bgm/BGM_Battle01.mp3'            },
    { key: BGM.TRY_COUNT_UP,        url: '/assets/bgm/BGM_TryCountUp.mp3'          },
    { key: BGM.STAGE_LOADING,       url: '/assets/bgm/BGM_StageLoading.mp3'        },
    { key: BGM.STAGE_LOADING_INTRO, url: '/assets/bgm/BGM_StageLoading_Intro.mp3'  },
    { key: BGM.TITLE,               url: '/assets/bgm/BGM_Title.mp3'               },
];
