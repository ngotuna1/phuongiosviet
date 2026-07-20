/* jhvnios mod - v2. Dat file nay tai thu muc goc jhvnios.app/mod.js. */
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
    autoMeridian: false
  };
  /* ================================= */

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

  /* ---- feature: subHp (godmode / giam dmg / dmg xN) ---- */
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

  /* ---- feature: tat QC (KUtil.playVideo) ---- */
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

  /* ---- feature: toc tran chi trong BattleUtil ---- */
  function applySpeed(){ try { if (cc&&cc.director&&cc.director.setTimeScale) cc.director.setTimeScale(1); } catch(e){} }

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

  function autoLevel(){
    if (!autoReady("level", 1200)) return;
    var models = getModels(), rpc = getRPCReq(), dynamic = window.DynamicConfigData;
    if (!models || !rpc || typeof rpc.send !== "function" || !dynamic || !models.PlayerModel) return;
    var player = models.PlayerModel, hero = dynamic.t_HeroLevel && dynamic.t_HeroLevel[player.level];
    if (!hero || player.exp < hero.process || (typeof player.isLimitLevel === "function" && player.isLimitLevel())) return;
    L("auto player level up");
    rpc.send("Player_UpPlayerLevel", {}, function(){}, function(e){ L("auto player level err " + e); });
  }

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

  function autoTick(){
    try {
      if (CFG.autoCultivate) autoCultivate();
      if (CFG.autoGrade) autoGrade();
      if (CFG.autoLevel) autoLevel();
      if (CFG.autoDevour || CFG.autoDevourEvolve || CFG.autoDevourDujie) autoDevour();
      if (CFG.autoMeridian) autoMeridian();
    } catch(e){ L("auto tick err " + e); }
    later(autoTick);
  }

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
      addText(panel, "JHVNIOS MOD", 25, 300, 42, 0, panelHeight / 2 - 30, "center");
      addButton(panel, "X", 42, 34, panelWidth / 2 - 30, panelHeight / 2 - 28, function(){ panel.active = false; });

      var refreshers = [];
      function refreshAll(){
        for (var i = 0; i < refreshers.length; i++) refreshers[i]();
      }
      function addToggleRow(title, key, y){
        addText(panel, title, 17, 340, 34, -panelWidth / 2 + 18, y, "left");
        var button = addButton(panel, "", 104, 32, panelWidth / 2 - 68, y, function(){
          CFG[key] = !CFG[key];
          refreshAll();
        });
        refreshers.push(function(){ button.setState(!!CFG[key], CFG[key] ? "BẬT" : "TẮT"); });
      }
      function addChoiceRow(title, key, values, suffix, y, selected){
        addText(panel, title, 17, 128, 34, -panelWidth / 2 + 18, y, "left");
        var startX = -panelWidth / 2 + 154;
        var cell = (panelWidth - 172) / values.length;
        for (var i = 0; i < values.length; i++) (function(value, index){
          var button = addButton(panel, String(value) + suffix, cell - 7, 32, startX + cell * index + cell / 2, y, function(){
            CFG[key] = value;
            if (selected) selected(value);
            refreshAll();
          });
          refreshers.push(function(){ button.setState(Number(CFG[key]) === Number(value), String(value) + suffix); });
        })(values[i], i);
      }

      var y = panelHeight / 2 - 78;
      var gap = 44;
      addToggleRow("God + One Hit", "godmode", y); y -= gap;
      addChoiceRow("Damage", "dmgMul", [1, 5, 10, 20], "x", y, function(value){ if (value > 1) CFG.godmode = false; }); y -= gap;
      addChoiceRow("Giảm damage", "dmgReducePct", [0, 50, 90, 99], "%", y); y -= gap;
      addChoiceRow("Speed", "speed", [1, 2, 3, 5], "x", y); y -= gap;
      addToggleRow("No Ads", "noAd", y); y -= gap;
      addToggleRow("Auto tu luyện", "autoCultivate", y); y -= gap;
      addToggleRow("Auto nhận + đột phá", "autoGrade", y); y -= gap;
      addToggleRow("Auto lên cấp", "autoLevel", y); y -= gap;
      addToggleRow("Auto Hấp thu", "autoDevour", y); y -= gap;
      addToggleRow("Auto Tiến hóa", "autoDevourEvolve", y); y -= gap;
      addToggleRow("Auto Độ kiếp", "autoDevourDujie", y); y -= gap;
      addToggleRow("Auto kinh mạch", "autoMeridian", y);
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
  var n=0, okS=false, okA=false;
  function tick(){
    n++;
    if (!okS) okS = hookSubHp();
    if (!okA) okA = hookAd();
    applySpeed();
    if (n===1 || n===40 || (okS&&okA&&n%20===0)) { L("tick "+n+" subHp="+okS+" ad="+okA); flush(); }
    if (n<1200 && (!okS || !okA)) later(tick);
  }
  installMenu();
  later(tick);
  later(autoTick);
})();
