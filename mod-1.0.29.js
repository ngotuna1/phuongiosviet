/* ĐÍT MẸ MÀY JHVN mod - v2.3. Dat file nay tai thu muc goc jhvnios.app/mod.js. */
(function () {
  "use strict";

  /* ===== CONFIG (chinh o day) ===== */
  var CFG = {
    dmgMul: 20,        // Sat thuong: 1 / 5 / 10 / 20
    dmgReducePct: 99,  // Giam sat thuong: 0 / 50 / 90 / 99
    godmode: true,     // bat tu (phe minh) + 1 hit (dich)
    speed: 5.0,        // Toc tran (BattleUtil)
    noAd: true,        // Tat quang cao (skip video, van nhan thuong)
    autoCultivate: false,
    autoGrade: false,
    autoLevel: false,
    autoDevour: false,
    autoDevourEvolve: false,
    autoDevourDujie: false,
    autoMeridian: false,
    autoMail: false,
    autoDaily: false,
    autoHang: false,
    autoPetLevel: false,
    autoSkillLevel: false,
    autoAchievement: false,
    autoTreasureLevel: false,
    autoRune: false,
    autoBattleSkill: false,
    autoMonster: false,
    autoTower: false,
    autoSign: false,
    autoEgg: false,
    autoEventReward: false,
    autoEventAd: false,
    fakeCombat: false,    // Lực chiến 100 triệu (ao)
    fakeCombatValue: "10770000000",
    fakeAttrMult: false,  // Thuộc tính x100
    fakeAttrMultVal: 100
  };
  /* ================================= */

  /*
   * DANH SACH CHUC NANG
   * Hack Damage / God / One Hit: hookSubHp()
   * No Ads: hookAd()
   * Speed: applySpeed()
   * Auto tu luyen: autoCultivate()
   * Auto nhan + dot pha: autoGrade()
   * Auto len cap: autoLevel()
   * Auto Hap thu / Tien hoa / Do kiep: autoDevour()
   * Auto kinh mach: autoMeridian()
   * Auto nhan thu: autoMailReward()
   * Auto nhiem vu ngay: autoDailyReward()
   * Auto nhan thuong treo may: autoHangReward()
   * Auto nang Pet: autoPetUpgrade()
   * Auto nang ky nang: autoSkillUpgrade()
   * Auto nang bao vat: autoTreasureUpgrade()
   * Auto gan Rune: autoRuneEquip()
   * Auto ky nang chien dau: setAutoBattleSkill()
   * Auto Monster + Skip: autoMonsterBattle()
   * Auto Thap Hong Hoang: autoTowerBattle()
   * Auto diem danh: autoSignReward()
   * Auto dap trung: autoEggLottery()
   * Du event dung thu: openEligibleTrial()
   * Auto nhan thuong event: autoEventRewards()
   * Mo event an: openHiddenEvent()
   */

  var TAG = "[jhvnmod]";
  var PROBE = null;
  var log = [];
  function L(s){ log.push(s); try { (typeof cc!=="undefined"&&cc.log)?cc.log(TAG+" "+s):console.log(TAG+" "+s); } catch(e){} }
  function flush(){
    try {
      if (typeof jsb!=="undefined" && jsb.fileUtils) {
        if (!PROBE) PROBE = jsb.fileUtils.getWritablePath()+"jhvnmod_probe.txt";
        jsb.fileUtils.writeStringToFile(log.join("\n"), PROBE);
      }
    } catch(e){}
  }

  window.__jhvnmod = CFG;
  L("injected. cc="+(typeof cc)+" jsb="+(typeof jsb)+" BigNumUtil="+(typeof window.BigNumUtil));

  /* ---- probe he thong module (de v2 wire chinh xac neu v1 chua toi) ---- */
  try {
    var wk = Object.keys(window);
    L("window keys="+wk.length);
    L("win Battle/Util/Mgr: "+wk.filter(function(k){return /Battle|Util|Mgr|Manager|KUtil/.test(k);}).slice(0,80).join(","));
    L("cc.js.getClassByName="+(typeof (cc&&cc.js&&cc.js.getClassByName)));
    L("setTimeout="+(typeof setTimeout)+" setTimeScale="+(typeof (cc&&cc.director&&cc.director.setTimeScale)));
  } catch(e){ L("probe err "+e); }

  function getModule(name){
    try {
      var req = window.__require || (typeof __require === "function" ? __require : null);
      return req ? req(name) : null;
    } catch(e){ return null; }
  }

  function getExport(name, key){
    var mod = getModule(name);
    return mod && (mod[key] || mod.default || mod);
  }

  function getModels(){ return getExport("ModelManager", "ModelManager"); }
  function getRPCReq(){ return getExport("RPCReq", "RPCReq"); }

  var autoNext = {};
  function autoReady(name, waitMs){
    var now = (new Date()).getTime();
    if (autoNext[name] && now < autoNext[name]) return false;
    autoNext[name] = now + waitMs;
    return true;
  }

  /* ---- tim object co method m ---- */
  function findObjWith(m){
    try { if (cc&&cc.js&&cc.js.getClassByName){ var c=cc.js.getClassByName("BattleUtil"); if(c){ if(c[m]) return c; if(c.prototype&&c.prototype[m]) return c.prototype; } } } catch(e){}
    try { for (var k in window){ var v=window[k]; if (v&&typeof v[m]==="function") return v; } } catch(e){}
    return null;
  }

  function findBattleUtil(){
    try {
      var mod = getModule("BattleUtil");
      var Klass = mod && (mod.BattleUtil || mod.default);
      if (Klass && Klass.prototype && typeof Klass.prototype.subHp === "function") return Klass.prototype;
    } catch(e){ L("BattleUtil require err "+e); }
    return findObjWith("subHp");
  }

  function getBigNumUtil(){
    if (window.BigNumUtil) return window.BigNumUtil;
    var mod = getModule("BigNumUtil");
    return mod && (mod.BigNumUtil || mod.default);
  }

  /* ===== HACK DAMAGE / GOD / ONE HIT ===== */
  function hookSubHp(){
    var BU = findBattleUtil();
    if (!BU) return false;
    if (BU.__jm) return true;
    var orig = BU.subHp, origGetBattleSpeed = BU.getBattleSpeed, calls = 0;
    if (typeof origGetBattleSpeed === "function") {
      BU.getBattleSpeed = function(){
        var normal = Number(origGetBattleSpeed.apply(this, arguments)) || 1;
        var requested = Math.max(1, Number(CFG.speed) || 1);
        return Math.max(normal, requested);
      };
    }
    BU.subHp = function(sourceId, targetId, amount){
      try {
        var BN = getBigNumUtil();
        var tgt = (typeof this.getEntity === "function") ? this.getEntity(targetId) : null;
        var enemy = tgt ? !!tgt.isMonster : false;
        var rawAmount = amount, oneHit = false;
        if (enemy){
          var hp = tgt && typeof tgt.getHp === "function" ? tgt.getHp() : null;
          if (CFG.godmode && hp != null) { amount = hp; oneHit = true; }
          else if (CFG.dmgMul>1 && BN&&BN.BigNumMul) amount = BN.BigNumMul(amount, CFG.dmgMul);
        } else {
          if (CFG.godmode) amount = "0";                                                // bat tu
          else if (CFG.dmgReducePct>0 && BN&&BN.BigNumDiv&&BN.ToString) {
            var remain = 100-CFG.dmgReducePct;
            var divisor = remain > 0 ? Math.round(100/remain) : 1000000;
            amount = BN.BigNumDiv(BN.ToString(amount), String(divisor))[0];
          }
        }
        calls++;
        if (calls <= 5) L("subHp #"+calls+" src="+sourceId+" target="+targetId+" enemy="+enemy+" raw="+(BN&&BN.ToString?BN.ToString(rawAmount):rawAmount)+" oneHit="+oneHit+" damage="+(BN&&BN.ToString?BN.ToString(amount):amount));
      } catch(e){ L("subHp hook err "+e); }
      var a=[sourceId,targetId,amount]; for(var i=3;i<arguments.length;i++) a.push(arguments[i]);
      return orig.apply(this, a);
    };
    BU.__jm = true; L("subHp + battle speed HOOKED via __require(BattleUtil)"); return true;
  }

  /* ===== NO ADS ===== */
  function hookAd(){
    var K = findObjWith("playVideo");
    if (!K) return false;
    if (K.__jm) return true;
    var orig = K.playVideo;
    K.playVideo = function(){
      if (!CFG.noAd) return orig.apply(this, arguments);
      var cb=null; for (var i=0;i<arguments.length;i++) if (typeof arguments[i]==="function"){ cb=arguments[i]; break; }
      L("playVideo skipped -> reward"); if (cb) try{ cb(); }catch(e){ L("ad cb err "+e); }
    };
    K.__jm = true; L("playVideo HOOKED"); return true;
  }


  /* ===== MO GRADE TOI DA ===== */
  function hookGradeMax(){
    try {
      var models = getModels();
      var gm = models && models.GradeModel;
      if (!gm) return false;
      if (gm.__jm_grade) return true;
      if (typeof gm.isMaxLevel === "function") {
        gm.isMaxLevel = function(){ return false; };
        L("GradeModel.isMaxLevel -> false");
      }
      if (typeof gm.isCultivalFull === "function") {
        gm.isCultivalFull = function(){ return true; };
        L("GradeModel.isCultivalFull -> true");
      }
      if (typeof gm.checkCanLevelUp === "function") {
        gm.checkCanLevelUp = function(){ return 2; };
        L("GradeModel.checkCanLevelUp -> always 2 (ready)");
      }
      /* set grade + player level len max, kèm hook giu level ko bi server ghi de */
      try {
        var dynamic = window.DynamicConfigData;
        var gradeCfg = dynamic && dynamic.t_Grade || {};
        var gradeLevels = Object.keys(gradeCfg).map(function(k){ return Number(k); }).filter(function(n){ return n > 0; }).sort(function(a,b){ return a-b; });
        var maxGrade = gradeLevels.length > 0 ? gradeLevels[gradeLevels.length - 1] : 10;
        /* set grade + stage de tranh loi canh gioi */
        if (gm.taskData) {
          gm.taskData.level = Math.max(gm.taskData.level || 1, maxGrade);
          var lastGrade = gradeCfg[maxGrade];
          if (lastGrade && lastGrade.stage) gm.taskData.stage = lastGrade.stage;
          L("Grade set level=" + gm.taskData.level + " stage=" + gm.taskData.stage);
        }
        /* set player level cao */
        var pm = models && models.PlayerModel;
        if (pm) {
          if (pm.level != null && pm.level < 300) { pm.level = 300; L("PlayerModel.level set to 300"); }
          if (typeof pm.isLimitLevel === "function" && !pm.isLimitLevel.__jm) {
            pm.isLimitLevel = function(){ return false; };
            pm.isLimitLevel.__jm = true;
            L("PlayerModel.isLimitLevel -> false");
          }
        }
        /* hook de giu level khi server cap nhat */
        var forceMaxGrade = function(self){
          try { self.taskData.level = Math.max(self.taskData.level || 1, maxGrade); } catch(e){}
        };
        if (typeof gm.Duty_Expupdate === "function" && !gm.Duty_Expupdate.__jm_g) {
          var origExp = gm.Duty_Expupdate; gm.Duty_Expupdate = function(){ origExp.apply(this,arguments); forceMaxGrade(this); };
          gm.Duty_Expupdate.__jm_g = true;
        }
        if (typeof gm.Record_SyncProgress === "function" && !gm.Record_SyncProgress.__jm_g) {
          var origRec = gm.Record_SyncProgress; gm.Record_SyncProgress = function(){ origRec.apply(this,arguments); forceMaxGrade(this); };
          gm.Record_SyncProgress.__jm_g = true;
        }
        if (typeof gm.loginPlayerDataFinish === "function" && !gm.loginPlayerDataFinish.__jm_g) {
          var origLogin = gm.loginPlayerDataFinish; gm.loginPlayerDataFinish = function(e){ origLogin.apply(this,arguments); this.taskData = this.taskData || {}; this.taskData.level = Math.max(this.taskData.level||1, maxGrade); };
          gm.loginPlayerDataFinish.__jm_g = true;
        }
        L("Grade max hooks active (level=" + maxGrade + ")");
      } catch(e){ L("grade hooks err "+e); }
      gm.__jm_grade = true;
      L("GradeModel hooks installed (unlock grade max limit)");
      flush();
      return true;
    } catch(e){ L("hookGradeMax err: "+e.message); flush(); return false; }
  }

  /* ===== MO DEVOUR (HAP THU) ===== */
  function hookDevourOpen(){
    try {
      var models = getModels();
      if (!models) return false;
      if (models.__jm_devour) return true;
      for (var k in models) {
        var v = models[k];
        if (v && typeof v === "object" && typeof v.isOpen === "function" && !v.__jm_devour) {
          v.isOpen = function(){ return true; };
          v.__jm_devour = true;
          L("DevourModel." + k + ".isOpen -> true");
        }
      }
      var mu = getExport("ModuleUtil", "ModuleUtil");
      if (mu && typeof mu.getModuleOpenTips === "function" && !mu.__jm_devour) {
        var origGetTips = mu.getModuleOpenTips;
        mu.getModuleOpenTips = function(id){
          if (id === 797 || id === 22 || id === "797" || id === "22") return null;
          return origGetTips.apply(this, arguments);
        };
        mu.__jm_devour = true;
        L("ModuleUtil.getModuleOpenTips patched for Devour");
      }
      /* CHAN TRUC TIEP RPCReq.send cho Devour */
      var RPC = getExport("RPCReq", "RPCReq");
      if (RPC && typeof RPC.send === "function" && !RPC.send.__jm_devour) {
        var origSend = RPC.send;
        RPC.send = function(rpcName, params, okCb, errCb){
          if (rpcName === "Devour_GameResult" || rpcName === "Devour_GameCost" || rpcName === "Devour_Game" || (rpcName && rpcName.indexOf("Devour_") === 0)) {
            L("Devour RPC blocked: " + rpcName);
            if (rpcName === "Devour_GameResult" && typeof okCb === "function") okCb({});
            if (rpcName === "Devour_GameCost" && typeof okCb === "function") okCb({success: true});
            return;
          }
          return origSend.apply(this, arguments);
        };
        RPC.send.__jm_devour = true;
        L("RPCReq.send HOOKED -> block all Devour_ RPCs");
      }
      models.__jm_devour = true;
      L("Devour unlock installed");
      flush();
      return true;
    } catch(e){ L("hookDevourOpen err: "+e.message); flush(); return false; }
  }

  /* ===== FAKE LUC CHIEN 100 TRIEU ===== */
  function hookFakeCombat(){
    try {
      var models = getModels();
      if (!models) return false;
      if (models.__jm_fakec) return true;
      var prm = models.PlayerRoleModel;
      if (!prm) return false;
      /* dung Object.defineProperty de intercept combat getter/setter */
      if (typeof prm.combat !== "undefined") {
        var realCombat_ = prm.combat;
        Object.defineProperty(prm, "combat", {
          get: function(){
            return CFG.fakeCombat ? CFG.fakeCombatValue : realCombat_;
          },
          set: function(v){ realCombat_ = v; },
          configurable: true,
          enumerable: true
        });
        L("PlayerRoleModel.combat HOOKED (fake=" + CFG.fakeCombatValue + ")");
      }
      models.__jm_fakec = true;
      flush();
      return true;
    } catch(e){ L("hookFakeCombat err: "+e.message); flush(); return false; }
  }

  /* ===== THUOC TINH x100 ===== */
  function hookFakeAttrs(){
    try {
      var models = getModels();
      if (!models) return false;
      var prm = models.PlayerRoleModel;
      if (!prm || typeof prm.getAttrValue !== "function") return false;
      if (prm.__jm_fattr) return true;
      var origGetAttr = prm.getAttrValue;
      prm.getAttrValue = function(attrId){
        var v = origGetAttr.apply(this, arguments);
        if (CFG.fakeAttrMult && attrId >= 1 && attrId <= 55) {
          var num = Number(v);
          if (num > 0 && isFinite(num)) return String(num * CFG.fakeAttrMultVal);
        }
        return v;
      };
      prm.__jm_fattr = true;
      L("PlayerRoleModel.getAttrValue HOOKED (x" + CFG.fakeAttrMultVal + ")");
      flush();
      return true;
    } catch(e){ L("hookFakeAttrs err: "+e.message); return false; }
  }

  /* ===== SPEED - removed setTimeScale (gây detect) ===== */

  /* ===== AUTO TU LUYEN ===== */
  function autoCultivate(){
    if (!autoReady("cultivate", 1500)) return;
    var models = getModels(), rpc = getRPCReq(), dynamic = window.DynamicConfigData;
    if (!models || !rpc || typeof rpc.send !== "function" || !dynamic || !models.PlayerModel || !models.GradeModel) return;
    var player = models.PlayerModel, duty = models.GradeModel.taskData;
    if (!duty || !duty.cultivates) return;
    var hero = dynamic.t_HeroLevel && dynamic.t_HeroLevel[player.level];
    if (!hero || player.exp >= hero.process) return;
    var cfg = dynamic.t_Cultivate && dynamic.t_Cultivate[duty.stage || 1];
    if (!cfg || typeof player.isCostEnough !== "function") return;
    var maxTimes = Math.min(9999, Math.max(0, hero.process - player.exp));
    var levels = {}, times = { 1: 0, 2: 0, 3: 0 }, totals = {};
    for (var i = 1; i <= 3; i++) levels[i] = (duty.cultivates[i] && duty.cultivates[i].level) || 0;
    function addCost(costs, direction){
      for (var c = 0; c < costs.length; c++) {
        var item = costs[c], key = item.type + ":" + item.code, total = totals[key];
        if (!total) total = totals[key] = { type: item.type, code: item.code, amount: 0 };
        total.amount += direction * (Number(item.amount) || 0);
        if (total.amount <= 0) delete totals[key];
      }
    }
    function totalCosts(){
      var costs = [];
      for (var key in totals) costs.push(totals[key]);
      return costs;
    }
    for (var n = 0; n < maxTimes; n++) {
      var minId = 0, minLevel = 999999;
      for (var id = 1; id <= 3; id++) {
        var level = levels[id] + times[id];
        if (level < cfg.maxLv && level < minLevel) { minLevel = level; minId = id; }
      }
      if (!minId) break;
      var cost = cfg["cost" + minId];
      if (!cost) break;
      addCost(cost, 1);
      if (!player.isCostEnough(totalCosts(), false)) {
        addCost(cost, -1);
        break;
      }
      times[minId]++;
    }
    var infos = [];
    for (var index = 1; index <= 3; index++) if (times[index] > 0) infos.push({ index: index, times: times[index] });
    if (!infos.length) return;
    L("auto cultivate batch=" + (times[1] + times[2] + times[3]));
    rpc.send("Duty_Cultivate", { infos: infos }, function(){}, function(e){ L("auto cultivate err " + e); });
  }

  /* ===== AUTO NHAN + DOT PHA ===== */
  function pendingDutyReward(models){
    var grade = models.GradeModel, dynamic = window.DynamicConfigData;
    if (!grade || !dynamic || !dynamic.t_Grade || !dynamic.t_GradeTask || typeof grade.getCurLevel !== "function") return null;
    var gradeCfg = dynamic.t_Grade[grade.getCurLevel()];
    if (!gradeCfg || !gradeCfg.taskId) return null;
    for (var i = 0; i < gradeCfg.taskId.length; i++) {
      var task = dynamic.t_GradeTask[gradeCfg.taskId[i]];
      var record = task && grade.getTaskRecordsData(task.recordId);
      var finished = record && record.finish && record.finish[0] >= 1;
      var got = record && record.got && record.got[0] >= 1;
      if (finished && !got) return task.recordId;
    }
    return null;
  }

  function autoGrade(){
    if (!autoReady("grade", 1200)) return;
    var models = getModels(), grade = models && models.GradeModel;
    if (!grade || typeof grade.checkCanLevelUp !== "function") return;
    var state = grade.checkCanLevelUp();
    if (state === 1 || state === 4) {
      var recordId = pendingDutyReward(models);
      if (recordId != null && typeof grade.reqGettReward === "function") {
        L("auto grade reward=" + recordId);
        grade.reqGettReward(recordId);
      }
    } else if (state === 2 && typeof grade.reqLevelUp === "function") {
      L("auto grade level up");
      grade.reqLevelUp(function(){});
    }
  }

  /* ===== AUTO LEN CAP NGUOI CHOI ===== */
  function autoLevel(){
    if (!autoReady("level", 1200)) return;
    var models = getModels(), rpc = getRPCReq(), dynamic = window.DynamicConfigData;
    if (!models || !rpc || typeof rpc.send !== "function" || !dynamic || !models.PlayerModel) return;
    var player = models.PlayerModel, hero = dynamic.t_HeroLevel && dynamic.t_HeroLevel[player.level];
    if (!hero || player.exp < hero.process || (typeof player.isLimitLevel === "function" && player.isLimitLevel())) return;
    L("auto player level up");
    rpc.send("Player_UpPlayerLevel", {}, function(){}, function(e){ L("auto player level err " + e); });
  }

  /* ===== AUTO DEVOUR: HAP THU / TIEN HOA / DO KIEP ===== */
  function autoDevour(){
    if (!autoReady("devour", 700)) return;
    var models = getModels(), devour = models && models.DevourModel, scene = devour && devour.behaviorScene;
    if (!scene || scene.progTimerId) return;
    if (CFG.autoDevourEvolve && devour.canEvolve && typeof scene.startEvolve === "function") {
      L("auto devour evolve");
      scene.startEvolve();
    } else if (CFG.autoDevourDujie && devour.canDujie && typeof scene.startDujie === "function") {
      L("auto devour dujie");
      scene.startDujie();
    } else if (CFG.autoDevour && scene.curCollectEntityId >= 0 && typeof scene.startDevour === "function") {
      L("auto devour collect=" + scene.curCollectEntityId);
      scene.startDevour();
    }
  }

  /* ===== AUTO KINH MACH ===== */
  function autoMeridian(){
    if (!autoReady("meridian", 1200)) return;
    var models = getModels(), dynamic = window.DynamicConfigData;
    if (!models || !models.PlayerModel || !models.PlayerRoleModel || !dynamic || !dynamic.t_MeridiansConstellation) return;
    var role = models.PlayerRoleModel, list = [], configs = dynamic.t_MeridiansConstellation;
    var role = models.PlayerRoleModel, list = [], configs = dynamic.t_MeridiansConstellation;
    if (typeof role.getIsCanActive !== "function") return;
    for (var id in configs) list.push(configs[id]);
    list.sort(function(a, b){ return b.id - a.id; });
    for (var i = 0; i < list.length; i++) {
      var cfg = list[i], data = role.constellation && role.constellation[cfg.id];
      if ((!data || !data.isActive) && role.getIsCanActive(cfg.id) && typeof role.reqMeridian_ConstellationActive === "function") {
        L("auto meridian constellation=" + cfg.id);
        role.reqMeridian_ConstellationActive(cfg.id, function(){});
        return;
      }
    }
    if (typeof role.getMeridiansPracticeConfigList !== "function" || typeof role.reqMeridian_MeridianActive !== "function") return;
    list.sort(function(a, b){ return a.id - b.id; });
    for (var j = 0; j < list.length; j++) {
      var meridian = list[j], state = role.constellation && role.constellation[meridian.id];
      if (!state || state.isFinish) continue;
      var levelIndex = Math.max((state.nowlevel || 0) - 1, 0);
      var levels = role.getMeridiansPracticeConfigList(state), choices = levels && levels[levelIndex];
      if (!choices || !choices.length) continue;
      var choiceIndex = 0;
      if (state.level) for (var k = 0; k < choices.length; k++) if (choices[k].id == state.level) {
        if (k == choices.length - 1 && levelIndex + 1 < levels.length) {
          levelIndex++;
          choices = levels[levelIndex];
          choiceIndex = 0;
        } else choiceIndex = Math.min(k + 1, choices.length - 1);
        break;
      }
      var choice = choices && choices[choiceIndex], cost = choice && choice.cost;
      if (cost && models.PlayerModel.isCostEnough(cost, false)) {
        L("auto meridian practice=" + meridian.id);
        role.reqMeridian_MeridianActive(meridian.id, 0, function(){}, function(e){ L("auto meridian err " + e); });
        return;
      }
    }
  }

  /* ===== AUTO NHAN THU ===== */
  var mailQueryAt = 0;
  function autoMailReward(){
    if (!autoReady("mail", 5000)) return;
    var models = getModels(), email = models && models.EmailModel, list = email && email.mailList;
    if (!email || typeof email.reqMailList !== "function" || typeof email.reqOneKeyExtract !== "function" || !Array.isArray(list)) return;
    if (!list.length) {
      var now = (new Date()).getTime();
      if (now - mailQueryAt >= 30000) {
        mailQueryAt = now;
        L("auto mail query");
        email.reqMailList();
      }
      return;
    }
    for (var i = 0; i < list.length; i++) if (list[i] && !list[i].hasGet) {
      L("auto mail extract");
      email.reqOneKeyExtract();
      return;
    }
  }

  /* ===== AUTO NHIEM VU NGAY ===== */
  function autoDailyReward(){
    if (!autoReady("daily", 4000)) return;
    var models = getModels(), daily = models && models.DailyTaskModel, dynamic = window.DynamicConfigData;
    if (!daily || typeof daily.getTaskRecordsData !== "function" || typeof daily.reqGettReward !== "function" || !dynamic || !dynamic.t_TaskDaily) {
      L("daily waiting model/config");
      flush();
      return;
    }
    if (!daily.taskData || !daily.taskData.records) {
      L("daily waiting task records");
      flush();
      return;
    }
    for (var key in dynamic.t_TaskDaily) {
      var cfg = dynamic.t_TaskDaily[key];
      if (!cfg || cfg.recordId == null) continue;
      var record = daily.getTaskRecordsData(cfg.recordId);
      if (record && record.finish && record.finish[0] >= 1 && (!record.got || record.got[0] < 1)) {
        if (Number(cfg.ad) === 1) {
          L("daily reward requires ad record=" + cfg.recordId);
          continue;
        }
        L("auto daily reward record=" + cfg.recordId);
        daily.reqGettReward(0, false, function(){});
        return;
      }
    }
    var boxes = dynamic.t_TaskDailyBox;
    if (!boxes || !Array.isArray(daily.reward) || typeof daily.getActiveRewardState !== "function" || typeof daily.reqGetActiveReward !== "function") {
      L("daily active reward unavailable");
      flush();
      return;
    }
    for (var boxKey in boxes) if (daily.getActiveRewardState(boxes[boxKey]) === 1) {
      L("auto daily active reward");
      daily.reqGetActiveReward();
      return;
    }
  }

  /* ===== AUTO NHAN THUONG TREO MAY ===== */
  function autoHangReward(){
    var models = getModels(), chapter = models && models.ChapterModel, rpc = getRPCReq();
    if (!chapter || !rpc || typeof rpc.send !== "function") return;
    if (chapter.showOfflineHangReward && autoReady("offlineHang", 60000)) {
      L("auto offline hang reward");
      rpc.send("Chapters_ReceiveHangUpReward", {}, function(){ chapter.showOfflineHangReward = false; });
      return;
    }
    if (!autoReady("hang", 300000) || typeof chapter.getTotalOnlineTime !== "function" || chapter.getTotalOnlineTime() < 300) return;
    L("auto hang reward");
    rpc.send("Chapters_ReceiveHangUpReward", {}, function(){});
  }

  /* ===== AUTO NANG PET ===== */
  function autoPetUpgrade(){
    if (!autoReady("petLevel", 8000)) return;
    var models = getModels(), model = models && models.PetModel;
    if (model && typeof model.reqLevelUpBatch === "function") {
      L("auto pet level batch");
      model.reqLevelUpBatch(function(){});
    }
  }

  /* ===== AUTO NANG KY NANG ===== */
  function autoSkillUpgrade(){
    if (!autoReady("skillLevel", 8000)) return;
    var models = getModels(), model = models && models.SkillEquipModel;
    if (model && typeof model.reqLevelUpBatch === "function") {
      L("auto skill level batch");
      model.reqLevelUpBatch(function(){});
    }
  }

  var achievementIds = null, achievementIndex = 0, achievementInFlight = false;
  function autoAchievementReward(){
    if (!autoReady("achievement", 700)) return;
    var rpc = getRPCReq(), configer = getExport("TaskConfiger", "TaskConfiger");
    if (!rpc || typeof rpc.send !== "function" || !configer || typeof configer.getAllAchieveConfig !== "function") return;
    if (!achievementIds) {
      achievementIds = [];
      var seen = {};
      function collect(value){
        if (!value || typeof value !== "object") return;
        if (value.recordId != null) {
          var id = Number(value.recordId);
          if (id > 0 && !seen[id]) {
            seen[id] = true;
            achievementIds.push(id);
          }
        }
        for (var key in value) if (Object.prototype.hasOwnProperty.call(value, key)) collect(value[key]);
      }
      collect(configer.getAllAchieveConfig());
      L("achievement records=" + achievementIds.length);
    }
    if (!achievementIds.length || achievementInFlight) return;
    var id = achievementIds[achievementIndex++ % achievementIds.length];
    achievementInFlight = true;
    try {
      rpc.send("Achieve_GetReward", { id: id }, function(){
        achievementInFlight = false;
      }, function(){
        achievementInFlight = false;
      });
    } catch(e) {
      achievementInFlight = false;
      L("achievement reward err " + e);
    }
  }

  /* ===== AUTO NANG BAO VAT ===== */
  function autoTreasureUpgrade(){
    if (!autoReady("treasureLevel", 8000)) return;
    var models = getModels(), model = models && models.TreasureModel, ids = [];
    if (!model || !model.t_Treasure || typeof model.isTreasureCanLevelUp !== "function" || typeof model.reqLevelUpBatch !== "function") return;
    for (var id in model.t_Treasure) {
      var cfg = model.getConfig ? model.getConfig(id) : model.t_Treasure[id];
      if (cfg && model.isTreasureCanLevelUp(cfg.id)) ids.push(cfg.id);
    }
    if (ids.length) {
      L("auto treasure level batch=" + ids.length);
      model.reqLevelUpBatch(ids);
    }
  }

  /* ===== AUTO GAN RUNE ===== */
  function autoRuneEquip(){
    if (!autoReady("rune", 15000)) return;
    var models = getModels(), model = models && models.EquipRuneModel;
    if (model && model.isOpen && typeof model.reqEquipOnekeyEquipRune === "function") {
      L("auto rune equip");
      model.reqEquipOnekeyEquipRune();
    }
  }

  /* ===== AUTO KY NANG CHIEN DAU ===== */
  function setAutoBattleSkill(enabled){
    if (enabled && !autoReady("battleSkill", 5000)) return;
    try {
      var models = getModels(), files = getExport("FileCacheManager", "FileCacheManager"), player = models && models.PlayerModel;
      if (files && player && player.userid != null && typeof files.setBoolForKey === "function") files.setBoolForKey("AutoUseSkill" + player.userid, !!enabled);
      var scene = cc && cc.director && cc.director.getScene ? cc.director.getScene() : null;
      var comps = scene && scene.getComponentsInChildren ? scene.getComponentsInChildren("ActiveSkillPanelCom") : [];
      for (var i = 0; i < comps.length; i++) if (comps[i].c1 && comps[i].c1.getSelectedIndex() !== (enabled ? 0 : 1)) {
        comps[i].c1.setSelectedIndex(enabled ? 0 : 1);
        if (typeof comps[i].onChangeAutoUse === "function") comps[i].onChangeAutoUse(null, true);
      }
    } catch(e){ L("auto skill battle err " + e); }
  }

  /* ===== AUTO MONSTER + SKIP ===== */
  function autoMonsterBattle(){
    if (!autoReady("monster", 30000)) return;
    var models = getModels(), model = models && models.MonsterComingModel;
    if (!model || !model.monsterInvade || typeof model.getCanSkipOrAutoState !== "function" || !model.getCanSkipOrAutoState() || typeof model.getEnableAutoFight !== "function" || !model.getEnableAutoFight()) return;
    if (model.isInAutoChallenge || typeof model.getChallengeNum !== "function") return;
    var challenge = model.getChallengeNum();
    if (!challenge || challenge[0] <= 0) return;
    if (typeof model.getEnableChangeSkip === "function" && model.getEnableChangeSkip() && typeof model.getSkipFight === "function" && !model.getSkipFight()) model.Activity_MonsterInvade_SetSkipFight(true);
    if (typeof model.getMonsterInvadeCfg !== "function" || typeof model.Activity_MonsterInvade_SetAutoFight !== "function") return;
    var invadeCfg = model.getMonsterInvadeCfg(), constants = window.DynamicConfigData && window.DynamicConfigData.t_MonsterInvadeConst;
    if (!invadeCfg || !constants) return;
    var eventInfo = invadeCfg.eventInfo || [], canAuto = constants.canAuto || [], autoMap = {};
    for (var i = 0; i < eventInfo.length; i++) {
      var cfg = window.DynamicConfigData.t_MonsterInvadeEvent[eventInfo[i].id];
      if (cfg && cfg.eventType == 2 && canAuto.indexOf(cfg.quality) >= 0) autoMap[eventInfo[i].id] = { id: eventInfo[i].id, multi: false, auto: true };
    }
    if (!Object.keys(autoMap).length) return;
    var views = getExport("ViewManager", "ViewManager");
    if (!views || typeof views.open !== "function") return;
    L("auto monster fight=" + Object.keys(autoMap).length);
    model.Activity_MonsterInvade_SetAutoFight(autoMap, function(){
      views.open("MonsterComingAutoView", { autoUse: false, num: 0 });
    });
  }

  var towerBusy = false;
  var TOWER_LAST_FLOOR = 2150;

  function setAutoTower(enabled){
    var models = getModels(), model = models && models.WarriorSpiritCopyModel;
    if (!model) return;
    model.autoFight = false;
    if (enabled) model.isJumpBattle = true;
  }

  function stopAutoTower(reason){
    CFG.autoTower = false;
    var models = getModels(), model = models && models.WarriorSpiritCopyModel;
    if (model) model.autoFight = false;
    L("auto tower stopped: " + reason);
    flush();
  }

  function hookTowerResult(model){
    if (model.__jhvnTowerResultHook || typeof model.reqCopy !== "function") return;
    var original = model.reqCopy;
    model.reqCopy = function(level, result, battleTime, battleRand, callback){
      return original.call(this, level, result, battleTime, battleRand, function(data){
        towerBusy = false;
        if (callback) callback(data);
      });
    };
    model.__jhvnTowerResultHook = true;
  }

  function fireFguiClick(target){
    if (!target) return false;
    if (typeof target.fireClick === "function") {
      target.fireClick();
      return true;
    }
    var callbacks = target.eventCallbackTable && target.eventCallbackTable.fui_click;
    if (!callbacks) return false;
    for (var key in callbacks) if (callbacks[key] && typeof callbacks[key].callback === "function") callbacks[key].callback();
    return true;
  }

  function autoTowerBattle(){
    if (!autoReady("tower", 1200)) return;
    var models = getModels(), model = models && models.WarriorSpiritCopyModel;
    if (!model || typeof model.getCopyLv !== "function" || typeof model.getWarriorCopyConfig !== "function" || typeof model.reqCopyEnter !== "function") return;
    hookTowerResult(model);
    model.autoFight = false;
    model.isJumpBattle = true;

    var passedFloor = Number(model.getCopyLv(false)) || 0;
    if (passedFloor >= TOWER_LAST_FLOOR) {
      stopAutoTower("reached floor " + TOWER_LAST_FLOOR);
      return;
    }

    var views = getExport("ViewManager", "ViewManager");
    if (views && typeof views.getView === "function") {
      if (views.getView("WarriorLoseView")) {
        stopAutoTower("battle lost at floor " + (passedFloor + 1));
        return;
      }
      var winView = views.getView("WarriorWinView");
      if (winView) {
        if (winView.specialRewards) {
          if (!winView.__jhvnTowerChestOpened) {
            winView.__jhvnTowerChestOpened = true;
            if (fireFguiClick(winView.btn)) {
              L("auto tower open chest floor=" + passedFloor);
              return;
            }
          }
          if (!winView.__jhvnTowerChestClaimed) {
            winView.__jhvnTowerChestClaimed = true;
            if (fireFguiClick(winView.ldBox)) {
              L("auto tower claim chest floor=" + passedFloor);
              return;
            }
          }
        }
        if (typeof winView.closeView === "function") winView.closeView();
      }
    }

    if (towerBusy || model.isRequesting) return;
    if (models.PlayerModel && typeof models.PlayerModel.checkMainScene === "function" && !models.PlayerModel.checkMainScene()) return;
    if (models.TeamModel && typeof models.TeamModel.hasTeam === "function" && models.TeamModel.hasTeam()) return;

    var floor = Number(model.getCopyLv()) || 0;
    var config = model.getWarriorCopyConfig(floor);
    if (!config || typeof model.checkLv !== "function" || !model.checkLv(false)) {
      stopAutoTower("floor " + floor + " is locked");
      return;
    }
    if (typeof model.getTicketCount === "function" && (Number(model.getTicketCount()) || 0) <= 0) {
      stopAutoTower("out of tickets at floor " + floor);
      return;
    }

    towerBusy = true;
    model.isRequesting = true;
    L("auto tower enter floor=" + floor);
    model.reqCopyEnter(floor, function(error){
      model.enterCd = 0;
      if (error) {
        model.isRequesting = false;
        towerBusy = false;
        stopAutoTower("enter rejected at floor " + floor);
        return;
      }
      if (typeof model.isTianzhu === "function" && model.isTianzhu(config, floor) && typeof model.reqCopy === "function") {
        model.reqCopy(floor, true, 2000, [], function(){});
      } else if (typeof model.jumpWarriorBattle === "function") {
        model.jumpWarriorBattle();
      }
    });
  }

  /* ===== AUTO DIEM DANH ===== */
  function autoSignReward(){
    if (!autoReady("sign", 10000)) return;
    var models = getModels(), seven = models && models.SevenDaySignModel, moon = models && models.MoonSignModel;
    if (seven && seven.status != null && !seven.status && !seven.endState && seven.daySignOrigin < 7 && typeof seven.reqDaySign === "function") {
      L("auto seven day sign");
      seven.reqDaySign();
      return;
    }
    if (!moon || typeof moon.isOpen !== "function" || !moon.isOpen()) return;
    var rewards = moon.getSignReward ? moon.getSignReward() : [];
    for (var i = 0; i < rewards.length; i++) if (moon.getSignRewardState(rewards[i].day) === 1) {
      L("auto moon sign=" + rewards[i].day);
      moon.reqSign(rewards[i].day, rewards[i].reward);
      return;
    }
    var totals = moon.getDayReward ? moon.getDayReward() : [];
    for (var j = 0; j < totals.length; j++) if (moon.getDayRewardState(totals[j].day) === 1) {
      L("auto moon total reward=" + totals[j].day);
      moon.reqTotalSignReward(totals[j].day, totals[j].reward);
      return;
    }
  }

  /* ===== AUTO DAP TRUNG ===== */
  function setEggAuto(enabled){
    var models = getModels(), map = models && models.actModelMap;
    if (!map) return;
    for (var key in map) {
      var model = map[key];
      if (model && typeof model.reqLottery === "function" && typeof model.getEggConfigs === "function") model.auto = !!enabled;
    }
  }

  function autoEggLottery(){
    if (!autoReady("egg", 1200)) return;
    var models = getModels(), map = models && models.actModelMap;
    if (!map) return;
    for (var key in map) {
      var model = map[key];
      if (model && typeof model.reqLottery === "function" && typeof model.getEggConfigs === "function") {
        model.auto = true;
        if (typeof model.canLottery === "function" && !model.canLottery()) continue;
        if (typeof model.getGotBig === "function" && model.getGotBig() && typeof model.reqNext === "function") {
          L("auto egg next");
          model.reqNext();
          return;
        }
        if (typeof model.getOneKeyShow !== "function" || !model.getOneKeyShow()) continue;
        if (typeof model.getFloorIsChose === "function" && model.getFloorIsChose() && (!model.getSelectId || !model.getSelectId())) continue;
        var player = models.PlayerModel;
        if (typeof model.getCostList === "function" && player && typeof player.isCostEnough === "function" && !player.isCostEnough(model.getCostList(), true)) continue;
        L("auto egg lottery type=" + key);
        model.reqLottery(0, true);
        return;
      }
    }
  }

  /* ===== DU EVENT DUNG THU ===== */
  function openEligibleTrial(){
    var models = getModels(), limit = models && models.LimitSummonModel;
    if (!limit || !limit.trialActivityList || typeof limit.isCanTry !== "function") return;
    for (var key in limit.trialActivityList) if (limit.isCanTry(Number(key))) {
      var type = Number(key), openers = [ models.ActFestivalModel, models.ActivityModel, models.getActModelByActType && models.getActModelByActType(type) ];
      for (var i = 0; i < openers.length; i++) if (openers[i] && typeof openers[i].openActivity === "function") {
        L("open eligible trial=" + type);
        openers[i].openActivity(type);
        return;
      }
    }
    L("no eligible trial");
  }

  /* ===== AUTO NHAN THUONG EVENT ===== */
  function hasPendingRecord(record){
    if (!record || !record.finish) return false;
    for (var i = 0; i < record.finish.length; i++) {
      var finish = Number(record.finish[i]) || 0, got = record.got ? Number(record.got[i]) || 0 : 0;
      if ((finish & ~got) !== 0) return true;
    }
    return false;
  }

  function findEventReward(){
    var models = getModels(), activity = models && models.ActivityModel, list = activity && activity.actData;
    if (!activity || !list || typeof activity.getActStatusAndLastTime !== "function") return null;
    for (var i = 0; i < list.length; i++) {
      var act = list[i];
      if (!act || activity.getActStatusAndLastTime(act.id)[0] !== 2) continue;
      var model = models.getActModelByActType && models.getActModelByActType(act.type), records = model && model.getReward;
      if (!records || typeof records !== "object") continue;
      for (var id in records) if (hasPendingRecord(records[id])) {
        var content = act.showContent || {};
        return { type: Number(act.type), id: Number(id) || 0, model: model, moduleId: Number(content.moduleId) || 1, needAd: Number(act.type) === 69 || content.needAd == 1 || content.ad == 1 };
      }
    }
    return null;
  }

  function claimEventReward(task){
    if (!task) return;
    L("auto event reward type=" + task.type + " task=" + task.id);
    if (task.model && typeof task.model.reqGetTaskReward === "function" && task.model.reqGetTaskReward.length <= 1) {
      try {
        task.model.reqGetTaskReward(task.id);
        L("event reward model request task=" + task.id);
        flush();
        return;
      } catch(e) { L("event reward model err " + e); }
    }
    var rpc = getRPCReq();
    if (!rpc || typeof rpc.send !== "function") {
      L("event reward RPC unavailable");
      flush();
      return;
    }
    rpc.send("Activity_GetTaskReward", { activityType: task.type, taskId: task.id }, function(){
      L("event reward RPC accepted type=" + task.type + " task=" + task.id);
      flush();
    }, function(e){
      L("event reward RPC err " + e);
      flush();
    });
  }

  var eventAdBusyUntil = 0;
  function autoEventRewards(){
    if (!autoReady("eventReward", 5000)) return;
    var task = findEventReward();
    if (!task) return;
    if (!task.needAd) {
      claimEventReward(task);
      return;
    }
    if (!CFG.autoEventAd || (new Date()).getTime() < eventAdBusyUntil) return;
    var sdk = getExport("SDKUtil", "SDKUtil");
    if (!sdk || typeof sdk.playVideo !== "function") return;
    eventAdBusyUntil = (new Date()).getTime() + 120000;
    var oldNoAd = CFG.noAd;
    CFG.noAd = false;
    L("play real event ad type=" + task.type);
    sdk.playVideo(task.type, task.moduleId, function(){
      eventAdBusyUntil = 0;
      claimEventReward(task);
    }, false, false);
    CFG.noAd = oldNoAd;
  }

  function claimAllVoucherRewards(){
    var models = getModels(), model = models && models.VoucherActivityModel;
    var taskModel = getExport("ActTaskModel", "ActTaskModel");
    if (!model || typeof model.getTaskConfig !== "function" || typeof model.getRecord !== "function" || typeof model.reqVoucherTaskGetTaskReward !== "function" || !taskModel) {
      L("voucher activity unavailable");
      flush();
      return;
    }
    var config = model.getTaskConfig(), pending = {};
    for (var hostType in config) {
      var groups = config[hostType];
      for (var type in groups) {
        var tasks = groups[type];
        for (var i = 0; i < tasks.length; i++) {
          var task = tasks[i], record = task && model.getRecord(task.recordId);
          if (record && taskModel.GetFinishFlag(record, task.seq) && !taskModel.GetRewardFlag(record, task.seq)) pending[task.recordId] = true;
        }
      }
    }
    var recordIds = Object.keys(pending);
    if (!recordIds.length) {
      L("voucher no completed reward");
      flush();
      return;
    }
    L("voucher claim all count=" + recordIds.length);
    flush();
    var index = 0;
    function claimNext(){
      if (index >= recordIds.length) {
        L("voucher claim all sent");
        flush();
        return;
      }
      var recordId = Number(recordIds[index++]);
      L("voucher claim record=" + recordId);
      model.reqVoucherTaskGetTaskReward(recordId);
      if (typeof setTimeout === "function") setTimeout(claimNext, 700); else claimNext();
    }
    claimNext();
  }

  /* ===== MO EVENT AN ===== */
  function openHiddenEvent(){
    var models = getModels(), activity = models && models.ActivityModel, list = activity && activity.actData;
    if (!activity || !Array.isArray(list) || typeof activity.getActStatusAndLastTime !== "function") {
      L("hidden event unavailable");
      flush();
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var act = list[i], type = act && Number(act.type);
      if (!act || activity.getActStatusAndLastTime(act.id)[0] !== 2) continue;
      if (typeof activity.showActivityEntrance === "function") activity.showActivityEntrance(type, true);
      var model = models.getActModelByActType && models.getActModelByActType(type);
      if (model && typeof model.openActivity === "function") {
        try {
          model.openActivity(type);
          L("active event model open type=" + type);
          flush();
          return;
        } catch(e) { L("event model open err type=" + type + " " + e); }
      }
      if (typeof activity.openActivity === "function") {
        try {
          activity.openActivity(type);
          L("active event activity open type=" + type);
          flush();
          return;
        } catch(e) { L("event activity open err type=" + type + " " + e); }
      }
    }
    L("no openable hidden event");
    flush();
  }

  /* ===== VONG LAP AUTO ===== */
  function runAuto(name, fn){
    try { fn(); } catch(e){ L("auto " + name + " err " + e); }
  }

  function autoTick(){
    if (CFG.autoCultivate) runAuto("cultivate", autoCultivate);
    if (CFG.autoGrade) runAuto("grade", autoGrade);
    if (CFG.autoLevel) runAuto("level", autoLevel);
    if (CFG.autoDevour || CFG.autoDevourEvolve || CFG.autoDevourDujie) runAuto("devour", autoDevour);
    if (CFG.autoMeridian) runAuto("meridian", autoMeridian);
    if (CFG.autoMail) runAuto("mail", autoMailReward);
    if (CFG.autoDaily) runAuto("daily", autoDailyReward);
    if (CFG.autoHang) runAuto("hang", autoHangReward);
    if (CFG.autoPetLevel) runAuto("pet", autoPetUpgrade);
    if (CFG.autoSkillLevel) runAuto("skill", autoSkillUpgrade);
    if (CFG.autoAchievement) runAuto("achievement", autoAchievementReward);
    if (CFG.autoTreasureLevel) runAuto("treasure", autoTreasureUpgrade);
    if (CFG.autoRune) runAuto("rune", autoRuneEquip);
    if (CFG.autoBattleSkill) runAuto("battle skill", function(){ setAutoBattleSkill(true); });
    if (CFG.autoMonster) runAuto("monster", autoMonsterBattle);
    if (CFG.autoTower) runAuto("tower", autoTowerBattle);
    if (CFG.autoSign) runAuto("sign", autoSignReward);
    if (CFG.autoEgg) runAuto("egg", autoEggLottery);
    if (CFG.autoEventReward) runAuto("event reward", autoEventRewards);
    later(autoTick);
  }

  /* ===== MENU MOD ===== */
  function installMenu(){
    if (typeof cc === "undefined" || !cc.director || !cc.Node || !cc.Graphics || !cc.Label) return;
    var menuRoot = null;

    function addText(parent, text, fontSize, width, height, x, y, align){
      var node = new cc.Node();
      node.setContentSize(width, height);
      node.setAnchorPoint(align === "left" ? 0 : 0.5, 0.5);
      node.setPosition(x, y);
      node.color = cc.Color.WHITE;
      var label = node.addComponent(cc.Label);
      label.string = text;
      label.fontSize = fontSize;
      label.lineHeight = height;
      label.horizontalAlign = align === "left" ? cc.Label.HorizontalAlign.LEFT : cc.Label.HorizontalAlign.CENTER;
      label.verticalAlign = cc.Label.VerticalAlign.CENTER;
      label.overflow = cc.Label.Overflow.SHRINK;
      parent.addChild(node);
      return label;
    }

    function drawButton(node, active){
      var g = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
      var size = node.getContentSize();
      g.clear();
      g.fillColor = active ? new cc.Color(111, 46, 187, 245) : new cc.Color(49, 52, 67, 245);
      g.strokeColor = active ? new cc.Color(204, 143, 255, 255) : new cc.Color(112, 116, 136, 255);
      g.lineWidth = 2;
      g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
      g.fill();
      g.stroke();
    }

    function addButton(parent, text, width, height, x, y, action){
      var node = new cc.Node();
      node.setContentSize(width, height);
      node.setPosition(x, y);
      parent.addChild(node);
      drawButton(node, false);
      var label = addText(node, text, 16, width - 8, height, 0, 0, "center");
      node.on(cc.Node.EventType.TOUCH_END, function(event){
        if (event && event.stopPropagation) event.stopPropagation();
        action();
      });
      node.setState = function(active, title){
        if (title != null) label.string = title;
        drawButton(node, active);
      };
      return node;
    }

    function drawStar(node){
      var g = node.addComponent(cc.Graphics);
      g.fillColor = new cc.Color(242, 25, 39, 255);
      g.strokeColor = new cc.Color(255, 84, 84, 255);
      g.lineWidth = 3;
      g.circle(0, 0, 36);
      g.fill();
      g.stroke();
      g.fillColor = new cc.Color(255, 211, 25, 255);
      for (var i = 0; i < 10; i++) {
        var radius = i % 2 === 0 ? 27 : 11;
        var angle = -Math.PI / 2 + i * Math.PI / 5;
        var x = Math.cos(angle) * radius;
        var y = Math.sin(angle) * radius;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.close();
      g.fill();
      g.strokeColor = new cc.Color(255, 235, 92, 255);
      g.lineWidth = 1;
      g.stroke();
    }

    function ensureMenu(){
      if (menuRoot && menuRoot.isValid !== false) return;
      var scene = cc.director.getScene();
      if (!scene) return;
      var visible = cc.view.getVisibleSize();
      var origin = cc.view.getVisibleOrigin ? cc.view.getVisibleOrigin() : cc.v2(0, 0);
      var root = new cc.Node("jhvnmod-menu-root");
      root.setAnchorPoint(0, 0);
      root.setContentSize(visible.width, visible.height);
      root.setPosition(origin.x, origin.y);
      root.zIndex = 2147483647;
      scene.addChild(root);
      if (cc.game && cc.game.addPersistRootNode) cc.game.addPersistRootNode(root);
      menuRoot = root;

      var panelWidth = 520;
      var panelHeight = 650;
      var panel = new cc.Node("jhvnmod-panel");
      panel.setContentSize(panelWidth, panelHeight);
      panel.setPosition(visible.width / 2, visible.height / 2);
      panel.scale = Math.min(1, (visible.width - 24) / panelWidth, (visible.height - 24) / panelHeight);
      panel.active = false;
      root.addChild(panel);
      if (cc.BlockInputEvents) panel.addComponent(cc.BlockInputEvents);
      var pg = panel.addComponent(cc.Graphics);
      pg.fillColor = new cc.Color(18, 19, 29, 245);
      pg.strokeColor = new cc.Color(178, 82, 255, 255);
      pg.lineWidth = 3;
      pg.rect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);
      pg.fill();
      pg.stroke();
      addText(panel, "JHVNIOS MOD v2.2", 25, 300, 42, 0, panelHeight / 2 - 30, "center");
      addButton(panel, "X", 42, 34, panelWidth / 2 - 30, panelHeight / 2 - 28, function(){ panel.active = false; });

      var refreshers = [];
      var pageBasic = new cc.Node("jhvnmod-basic-page");
      var pageAuto = new cc.Node("jhvnmod-auto-page");
      var pageEvent = new cc.Node("jhvnmod-event-page");
      var pageSupport = new cc.Node("jhvnmod-support-page");
      panel.addChild(pageBasic);
      panel.addChild(pageAuto);
      panel.addChild(pageEvent);
      panel.addChild(pageSupport);
      function refreshAll(){
        for (var i = 0; i < refreshers.length; i++) refreshers[i]();
      }
      function addToggleRow(parent, title, key, y, changed){
        addText(parent, title, 17, 340, 34, -panelWidth / 2 + 18, y, "left");
        var button = addButton(parent, "", 104, 32, panelWidth / 2 - 68, y, function(){
          CFG[key] = !CFG[key];
          if (changed) changed(CFG[key]);
          refreshAll();
        });
        refreshers.push(function(){ button.setState(!!CFG[key], CFG[key] ? "BẬT" : "TẮT"); });
      }
      function addChoiceRow(parent, title, key, values, suffix, y, selected){
        addText(parent, title, 17, 128, 34, -panelWidth / 2 + 18, y, "left");
        var startX = -panelWidth / 2 + 154;
        var cell = (panelWidth - 172) / values.length;
        for (var i = 0; i < values.length; i++) (function(value, index){
          var button = addButton(parent, String(value) + suffix, cell - 7, 32, startX + cell * index + cell / 2, y, function(){
            CFG[key] = value;
            if (selected) selected(value);
            refreshAll();
          });
          refreshers.push(function(){ button.setState(Number(CFG[key]) === Number(value), String(value) + suffix); });
        })(values[i], i);
      }
      function addActionRow(parent, title, buttonTitle, y, action){
        addText(parent, title, 17, 340, 34, -panelWidth / 2 + 18, y, "left");
        addButton(parent, buttonTitle, 104, 32, panelWidth / 2 - 68, y, action);
      }
      var tabBasic = addButton(panel, "CƠ BẢN", 125, 34, -187.5, panelHeight / 2 - 70, function(){ setTab(0); });
      var tabAuto = addButton(panel, "AUTO", 125, 34, -62.5, panelHeight / 2 - 70, function(){ setTab(1); });
      var tabEvent = addButton(panel, "EVENT", 125, 34, 62.5, panelHeight / 2 - 70, function(){ setTab(2); });
      var tabSupport = addButton(panel, "HỖ TRỢ", 125, 34, 187.5, panelHeight / 2 - 70, function(){ setTab(3); });
      function setTab(index){
        pageBasic.active = index === 0;
        pageAuto.active = index === 1;
        pageEvent.active = index === 2;
        pageSupport.active = index === 3;
        tabBasic.setState(index === 0, "CƠ BẢN");
        tabAuto.setState(index === 1, "AUTO");
        tabEvent.setState(index === 2, "EVENT");
        tabSupport.setState(index === 3, "HỖ TRỢ");
      }

      var y = panelHeight / 2 - 116;
      var gap = 40;
      addToggleRow(pageBasic, "God + One Hit", "godmode", y); y -= gap;
      addChoiceRow(pageBasic, "Damage", "dmgMul", [1, 5, 10, 20], "x", y, function(value){ if (value > 1) CFG.godmode = false; }); y -= gap;
      addChoiceRow(pageBasic, "Giảm damage", "dmgReducePct", [0, 50, 90, 99], "%", y); y -= gap;
      addChoiceRow(pageBasic, "Speed", "speed", [1, 2, 3, 5], "x", y); y -= gap;
      addToggleRow(pageBasic, "No Ads", "noAd", y); y -= gap;
      addToggleRow(pageBasic, "Auto tu luyện", "autoCultivate", y); y -= gap;
      addToggleRow(pageBasic, "Auto nhận + đột phá", "autoGrade", y); y -= gap;
      addToggleRow(pageBasic, "Auto lên cấp", "autoLevel", y); y -= gap;
      addToggleRow(pageBasic, "Auto Hấp thu", "autoDevour", y); y -= gap;
      addToggleRow(pageBasic, "Auto Tiến hóa", "autoDevourEvolve", y); y -= gap;
      addToggleRow(pageBasic, "Auto Độ kiếp", "autoDevourDujie", y); y -= gap;
      addToggleRow(pageBasic, "Auto kinh mạch", "autoMeridian", y); y -= gap;
      addToggleRow(pageBasic, "Lực chiến 100tr (ảo)", "fakeCombat", y); y -= gap;
      addToggleRow(pageBasic, "Thuộc tính x100", "fakeAttrMult", y);

      y = panelHeight / 2 - 116;
      addToggleRow(pageAuto, "Auto nhận thư", "autoMail", y); y -= gap;
      addToggleRow(pageAuto, "Auto nhiệm vụ ngày", "autoDaily", y); y -= gap;
      addToggleRow(pageAuto, "Auto nhận treo máy", "autoHang", y); y -= gap;
      addToggleRow(pageAuto, "Auto nâng Pet", "autoPetLevel", y); y -= gap;
      addToggleRow(pageAuto, "Auto nâng kỹ năng", "autoSkillLevel", y); y -= gap;
      addToggleRow(pageAuto, "Auto nhận thành tích", "autoAchievement", y); y -= gap;
      addToggleRow(pageAuto, "Auto nâng bảo vật", "autoTreasureLevel", y); y -= gap;
      addToggleRow(pageAuto, "Auto gắn Rune", "autoRune", y); y -= gap;
      addToggleRow(pageAuto, "Auto kỹ năng chiến đấu", "autoBattleSkill", y, setAutoBattleSkill); y -= gap;
      addToggleRow(pageAuto, "Auto Monster + Skip", "autoMonster", y); y -= gap;
      addToggleRow(pageAuto, "Auto Tháp 1-2150", "autoTower", y, setAutoTower); y -= gap;
      addToggleRow(pageAuto, "Auto điểm danh/event", "autoSign", y); y -= gap;
      addToggleRow(pageAuto, "Auto đập trứng", "autoEgg", y, setEggAuto); y -= gap;
      addActionRow(pageAuto, "Dùng thử hợp lệ", "MỞ", y, openEligibleTrial);

      y = panelHeight / 2 - 116;
      addToggleRow(pageEvent, "Auto nhận thưởng event", "autoEventReward", y); y -= gap;
      addToggleRow(pageEvent, "Auto QC event thật", "autoEventAd", y); y -= gap;
      addActionRow(pageEvent, "Hiện/mở event ẩn", "MỞ", y, openHiddenEvent); y -= gap;
      addActionRow(pageEvent, "Phiếu ưu đãi đã xong", "NHẬN HẾT", y, claimAllVoucherRewards); y -= gap;
      addText(pageEvent, "QC chỉ nhận sau khi server xác nhận xem hết.", 15, 470, 32, 0, y - 8, "center");

      y = panelHeight / 2 - 116;
      addText(pageSupport, "Tạo guest mới", 17, 340, 34, -panelWidth / 2 + 18, y, "left");
      var clearDataArmed = false;
      var clearDataButton = addButton(pageSupport, "XÓA", 104, 32, panelWidth / 2 - 68, y, function(){
        if (!clearDataArmed) {
          clearDataArmed = true;
          clearDataButton.setState(false, "XÁC NHẬN");
          L("clear local data confirmation requested");
          flush();
          return;
        }
        try {
          if (!cc.sys || !cc.sys.localStorage || typeof cc.sys.localStorage.clear !== "function") {
            L("clear local data unavailable");
            clearDataArmed = false;
            clearDataButton.setState(false, "XÓA");
            flush();
            return;
          }
          cc.sys.localStorage.clear();
          clearDataArmed = false;
          clearDataButton.setState(false, "ĐÃ XÓA");
          var login = getExport("LoginUtil", "LoginUtil");
          var loginModel = login && login.LoginModel;
          if (loginModel) {
            if (typeof loginModel.setUserName === "function") loginModel.setUserName("");
            if (typeof loginModel.setToken === "function") loginModel.setToken("");
            if (loginModel.__loginAccount) loginModel.__loginAccount.password = "";
          }
          var rp = getExport("RPUtil", "RPUtil");
          var loadingPhp = getExport("LoadingPHPUtil", "LoadingPHPUtil");
          var files = getExport("FileCacheManager", "FileCacheManager");
          if (rp) rp._deviceId = null;
          if (loadingPhp) loadingPhp._deviceId = null;
          if (files) files.deviceId = null;
          L("guest cache and device id reset; requesting official logout");
          flush();
          var flow = getExport("FlowManager", "FlowManager");
          if (login && typeof login.backToLogin === "function") {
            login.backToLogin(3);
          } else if (flow && typeof flow.backToLogin === "function") {
            flow.backToLogin(true);
          } else {
            L("official logout unavailable; restart app manually");
            flush();
          }
        } catch(e) {
          clearDataArmed = false;
          clearDataButton.setState(false, "XÓA");
          L("clear local data error "+e);
          flush();
        }
      });
      addText(pageSupport, "Khởi động lại để game tự tạo guest mới.", 15, 470, 40, 0, y - 48, "center");

      setTab(0);
      refreshAll();

      var star = new cc.Node("jhvnmod-star");
      star.setContentSize(78, 78);
      star.setPosition(52, Math.max(58, visible.height * 0.56));
      root.addChild(star);
      drawStar(star);
      var moved = false;
      var start = null;
      star.on(cc.Node.EventType.TOUCH_START, function(event){
        moved = false;
        start = event.getLocation();
        if (event.stopPropagation) event.stopPropagation();
      });
      star.on(cc.Node.EventType.TOUCH_MOVE, function(event){
        var location = event.getLocation();
        if (start && cc.Vec2.distance(start, location) > 8) moved = true;
        var point = root.convertToNodeSpaceAR(location);
        point.x = Math.max(40, Math.min(visible.width - 40, point.x));
        point.y = Math.max(40, Math.min(visible.height - 40, point.y));
        star.setPosition(point);
        if (event.stopPropagation) event.stopPropagation();
      });
      star.on(cc.Node.EventType.TOUCH_END, function(event){
        if (!moved) panel.active = !panel.active;
        if (event.stopPropagation) event.stopPropagation();
      });
      star.on(cc.Node.EventType.TOUCH_CANCEL, function(event){
        if (event.stopPropagation) event.stopPropagation();
      });
      L("Cocos menu installed");
      flush();
    }

    cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, ensureMenu);
    try { if (cc.director.getScene()) setTimeout(ensureMenu, 0); } catch(e){}
  }

  /* ---- doi module load xong roi hook (poll) ---- */
  function later(fn){
    try { if (typeof setTimeout==="function"){ setTimeout(fn, 500); return; } } catch(e){}
    try { cc.director.getScheduler().schedule(fn, cc.director, 0.5, 0, 0, false); } catch(e){}
  }
  var n=0, okS=false, okA=false, okE=false, okG=false, okD=false, okF=false, okA2=false;

  /* ===== HIEN THI SU KIEN AN ===== */
  var eventPatched = false;
  function showHiddenEvents(){
    if (eventPatched) return true;
    try {
      var models = getModels(), activity = models && models.ActivityModel;
      if (!activity || !Array.isArray(activity.actData) || activity.actData.length === 0) return false;

      var SDK = getExport("SDKUtil", "SDKUtil") || window.SDKUtil;
      if (SDK && typeof SDK.isVerifyApp === "function") {
        SDK.isVerifyApp = function(){ return false; };
        L("SDKUtil.isVerifyApp patched");
      }

      var ActivityMap = getExport("ActivityMap", "ActivityMap") || window.ActivityMap;
      if (ActivityMap) {
        ActivityMap.NotShowEntranceActivity = {};
        L("NotShowEntranceActivity cleared");
      }

      if (activity.examMaskActivityIds) {
        activity.examMaskActivityIds = {};
        L("examMaskActivityIds cleared");
      }

      /* HOOK TRUC TIEP cac method locate activity */
      try {
        if (typeof activity.getActivityInfoList === "function" && !activity.getActivityInfoList.__jm) {
          var origInfo = activity.getActivityInfoList;
          activity.getActivityInfoList = function(){
            var SDK2 = getExport("SDKUtil", "SDKUtil") || window.SDKUtil;
            try { SDK2.isVerifyApp = function(){ return false; }; } catch(e){}
            return origInfo.apply(this, arguments);
          };
          activity.getActivityInfoList.__jm = true;
          L("getActivityInfoList HOOKED (force isVerifyApp=false)");
        }
        if (typeof activity.getRankActivityInfoList === "function" && !activity.getRankActivityInfoList.__jm) {
          var origRank = activity.getRankActivityInfoList;
          activity.getRankActivityInfoList = function(){
            var SDK2 = getExport("SDKUtil", "SDKUtil") || window.SDKUtil;
            try { SDK2.isVerifyApp = function(){ return false; }; } catch(e){}
            return origRank.apply(this, arguments);
          };
          activity.getRankActivityInfoList.__jm = true;
          L("getRankActivityInfoList HOOKED");
        }
      } catch(e4){ L("hook getActivityInfoList err "+e4); }

      /* force rebuild data */
      if (typeof activity.clearData === "function" && typeof activity.screenActvity === "function") {
        activity.clearData();
        activity.screenActvity();
        L("ActivityModel screen rebuilt");
      }

      /* force MainUIBottom refresh */
      try {
        var vm = getExport("ViewManager", "ViewManager");
        if (vm && vm.mainUIBottom && typeof vm.mainUIBottom.updateEnter === "function") {
          vm.mainUIBottom.updateEnter();
          vm.mainUIBottom.updateButtons();
          L("MainUIBottom refreshed");
        }
      } catch(e3){}

      eventPatched = true;
      flush();
      return true;
    } catch(e){ L("showHiddenEvents err: "+e.message); flush(); return false; }
  }

  /* ===== DIAGNOSTIC SERVER TIME CHECK ===== */
  var cheatCheckLogPatched = false;
  function hookCheatCheckLog(){
    if (cheatCheckLogPatched) return true;
    var models = getModels();
    var serverTime = models && models.ServerTimeModel;
    if (!serverTime) return false;

    var target = serverTime;
    if (typeof target.doCheatCheck !== "function" && target.prototype) target = target.prototype;
    if (typeof target.doCheatCheck !== "function") return false;

    /* THAY THE doCheatCheck: khong goi RPC, khong bi detect */
    target.doCheatCheck = function(){
      L("cheat check blocked");
      /* van cap nhat thoi gian de game ko bi sai lech */
      try {
        var stm = models && models.ServerTimeModel;
        if (stm && typeof stm.getServerTimeMS === "function") {
          this.checkNowTime = stm.getServerTimeMS();
        }
      } catch(e){}
      return;
    };

    /* THAY THE initCheatCheck: khong lam gi */
    if (typeof target.initCheatCheck === "function") {
      target.initCheatCheck = function(){
        L("cheat check init blocked");
        this.checkNowTime = -1;
        /* khong goi RPC Player_ServerMsCheck */
      };
    }

    /* patch __IS_RELEASE__ de game nghi la dang o moi truong release */
    if (typeof window.__IS_RELEASE__ !== "undefined") {
      window.__IS_RELEASE__ = true;
      L("__IS_RELEASE__ set to true (tranh cheat check)");
    }

    cheatCheckLogPatched = true;
    L("Anti-cheat bypass installed (doCheatCheck blocked, initCheatCheck skipped)");
    flush();
    return true;
  }

  function tick(){
    n++;
    if (!okS) okS = hookSubHp();
    if (!okA) okA = hookAd();
    if (!okG) okG = hookGradeMax();
    if (!okD) okD = hookDevourOpen();
    if (!okF) okF = hookFakeCombat();
    if (!okA2) okA2 = hookFakeAttrs();
    hookCheatCheckLog();
    if (!okE) okE = showHiddenEvents();
    // applySpeed removed - setTimeScale bị game detect
    if (n===1 || n===40 || (okS&&okA&&okE&&n%20===0)) { L("tick "+n+" subHp="+okS+" ad="+okA+" event="+okE+" grade="+okG+" devour="+okD+" fake="+okF+" attrs="+okA2); flush(); }
    if (n<1200 && (!okS || !okA || !okE  || !okG || !okD || !okF || !okA2)) later(tick);
  }
  installMenu();
  later(tick);
  later(autoTick);
})();
