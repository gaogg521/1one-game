# -*- coding: utf-8 -*-
"""Build 1ONE commercial roadshow deck via officecli."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

FILE = Path(r"D:\website\1ONE-AI闭环-商业路演.pptx")

# Teal Trust / 1ONE deep-space
D, P, S, A = "0A2E36", "028090", "00A896", "02C39A"
L, T, M, W, C2 = "F0FAF8", "1A2F33", "5E8C8C", "FFFFFF", "E6F7F5"


def run(*args: str) -> None:
    cmd = ["officecli", *args]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print("FAIL:", " ".join(cmd[:6]), file=sys.stderr)
        print(r.stderr or r.stdout, file=sys.stderr)
        raise SystemExit(r.returncode)


def batch(ops: list[dict]) -> None:
    payload = json.dumps(ops, ensure_ascii=False)
    r = subprocess.run(
        ["officecli", "batch", str(FILE)],
        input=payload,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        print("BATCH FAIL", file=sys.stderr)
        print(r.stderr or r.stdout, file=sys.stderr)
        raise SystemExit(r.returncode)


def slide(bg: str) -> None:
    run("add", str(FILE), "/", "--type", "slide", "--prop", "layout=blank", "--prop", f"background={bg}")


def shape(n: int, **props) -> dict:
    p = {k: str(v) for k, v in props.items()}
    return {"command": "add", "parent": f"/slide[{n}]", "type": "shape", "props": p}


def notes(n: int, text: str) -> None:
    run("add", str(FILE), f"/slide[{n}]", "--type", "notes", "--prop", f"text={text}")


def title(n: int, text: str, *, dark: bool = False) -> dict:
    return shape(
        n,
        name="Title",
        text=text,
        x="1.5cm",
        y="1cm",
        width="30.87cm",
        height="2.4cm",
        font="Georgia",
        size="34",
        bold="true",
        color=W if dark else P,
        fill="none",
    )


def main() -> None:
    if FILE.exists():
        FILE.unlink()
    FILE.parent.mkdir(parents=True, exist_ok=True)
    run("create", str(FILE), "--type", "pptx")

    # ── 1 Cover ──
    print("1 cover")
    slide(D)
    batch(
        [
            shape(1, name="Band", geometry="rect", fill=A, x="0cm", y="18.5cm", width="33.87cm", height="0.55cm", line="none"),
            shape(1, text="1ONE 生态 · 商业战略路演", x="2cm", y="3.8cm", width="29.87cm", height="1cm", font="Calibri", size="16", color=A, align="center", fill="none"),
            shape(1, text="内容获客 × 职场交付 × AI 聚合", x="1.5cm", y="5.5cm", width="30.87cm", height="3cm", font="Georgia", size="36", bold="true", color=W, align="center", fill="none"),
            shape(1, text="Operone 对标小红书/抖音的内容能力，用创作者与社群裂变装流量\n1ONE Work 对标腾讯 WorkBuddy，做团队可交付的 AI Cowork\nOneRoute + OpenClaw 提供底层模型聚合与 Agent 基建，打通整套 AI 闭环", x="2.5cm", y="9.2cm", width="28.87cm", height="4cm", font="Calibri", size="18", color="B8E0DC", align="center", fill="none"),
            shape(1, text="战略宣讲  ·  2026", x="2cm", y="14.8cm", width="29.87cm", height="1cm", font="Calibri", size="16", color=S, align="center", fill="none"),
        ]
    )

    # ── 2 TL;DR ──
    print("2 tldr")
    slide(W)
    batch(
        [
            title(2, "一页讲清：三条价值线，一个闭环"),
            shape(2, geometry="roundRect", fill=L, x="1.5cm", y="4cm", width="9.78cm", height="12.2cm", line="none"),
            shape(2, text="01", x="1.5cm", y="4.5cm", width="9.78cm", height="1.8cm", font="Georgia", size="40", bold="true", color=A, align="center", fill="none"),
            shape(2, text="Operone", x="1.5cm", y="6.5cm", width="9.78cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, align="center", fill="none"),
            shape(2, text="内容平台\n对标小红书 + 抖音\n\n个人创作者生产\n竖滑 Feed 消费\n社群裂变装流量\n流量换成价值", x="1.8cm", y="8cm", width="9.2cm", height="7.5cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(2, geometry="roundRect", fill=L, x="12.04cm", y="4cm", width="9.78cm", height="12.2cm", line="none"),
            shape(2, text="02", x="12.04cm", y="4.5cm", width="9.78cm", height="1.8cm", font="Georgia", size="40", bold="true", color=A, align="center", fill="none"),
            shape(2, text="1ONE Work", x="12.04cm", y="6.5cm", width="9.78cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, align="center", fill="none"),
            shape(2, text="职场生产力\n对标腾讯 WorkBuddy\n\n多 Agent Cowork\nIssues 写进交付\n本机隐私默认\n桌面端 1ONE Code", x="12.34cm", y="8cm", width="9.2cm", height="7.5cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(2, geometry="roundRect", fill=D, x="22.58cm", y="4cm", width="9.78cm", height="12.2cm", line="none"),
            shape(2, text="03", x="22.58cm", y="4.5cm", width="9.78cm", height="1.8cm", font="Georgia", size="40", bold="true", color=A, align="center", fill="none"),
            shape(2, text="AI 聚合底座", x="22.58cm", y="6.5cm", width="9.78cm", height="1.2cm", font="Calibri", size="20", bold="true", color=W, align="center", fill="none"),
            shape(2, text="OneRoute 多模网关\nOpenClaw Agent 运维\n\n统一供给与计量\n支撑创作与办公\n成本可控可观测\n形成战略闭环", x="22.88cm", y="8cm", width="9.2cm", height="7.5cm", font="Calibri", size="18", color="E0F5F2", align="center", fill="none"),
        ]
    )
    notes(2, "开场只讲三件事：Operone 做内容流量；Work 做职场交付；底座做 AI 聚合。闭环 = 前台消耗模型能力，底座降本增效反哺前台。")

    # ── 3 Why Now ──
    print("3 why now")
    slide(W)
    batch(
        [
            title(3, "为什么是现在：三股力量同时成熟"),
            shape(3, geometry="roundRect", fill=L, x="1.5cm", y="4.2cm", width="9.78cm", height="11.5cm", line="none"),
            shape(3, text="内容侧", x="1.5cm", y="4.8cm", width="9.78cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, align="center", fill="none"),
            shape(3, text="竖滑 Feed\n已成默认消费形态", x="1.8cm", y="6.5cm", width="9.2cm", height="3cm", font="Georgia", size="24", bold="true", color=T, align="center", fill="none"),
            shape(3, text="抖音/小红书证明：\n创作者供给 + 信息流消费\n= 可规模化获客机器", x="1.8cm", y="10.2cm", width="9.2cm", height="4.5cm", font="Calibri", size="18", color=M, align="center", fill="none"),
            shape(3, geometry="roundRect", fill=L, x="12.04cm", y="4.2cm", width="9.78cm", height="11.5cm", line="none"),
            shape(3, text="办公侧", x="12.04cm", y="4.8cm", width="9.78cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, align="center", fill="none"),
            shape(3, text="Agent 从聊天\n走向可交付同事", x="12.34cm", y="6.5cm", width="9.2cm", height="3cm", font="Georgia", size="24", bold="true", color=T, align="center", fill="none"),
            shape(3, text="WorkBuddy / Cowork 赛道爆发\n企业要的是结果进看板，\n不是又一个对话框", x="12.34cm", y="10.2cm", width="9.2cm", height="4.5cm", font="Calibri", size="18", color=M, align="center", fill="none"),
            shape(3, geometry="roundRect", fill=L, x="22.58cm", y="4.2cm", width="9.78cm", height="11.5cm", line="none"),
            shape(3, text="供给侧", x="22.58cm", y="4.8cm", width="9.78cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, align="center", fill="none"),
            shape(3, text="多模竞争\n聚合网关成刚需", x="22.88cm", y="6.5cm", width="9.2cm", height="3cm", font="Georgia", size="24", bold="true", color=T, align="center", fill="none"),
            shape(3, text="一路接入百模、统一账单\n与智能路由，决定前台\n能否低成本规模化", x="22.88cm", y="10.2cm", width="9.2cm", height="4.5cm", font="Calibri", size="18", color=M, align="center", fill="none"),
        ]
    )
    notes(3, "Why now：内容消费形态、Agent 交付形态、模型供给形态三线汇合。1ONE 同时占内容获客与职场交付，底座自建聚合。")

    # ── 4 Operone market role ──
    print("4 operone role")
    slide(W)
    batch(
        [
            title(4, "Operone：不是工具站，是内容获客引擎"),
            shape(4, text="对标能力 = 小红书的创作者与社区 × 抖音的竖滑 Feed 消费", x="1.5cm", y="3.6cm", width="30.87cm", height="1.4cm", font="Calibri", size="20", color=S, fill="none"),
            shape(4, geometry="roundRect", fill=D, x="1.5cm", y="5.4cm", width="14.8cm", height="11cm", line="none"),
            shape(4, text="供给 · 像小红书", x="1.8cm", y="5.9cm", width="14.2cm", height="1.3cm", font="Calibri", size="22", bold="true", color=A, fill="none"),
            shape(4, text="· 个人创作者一句话出游戏/小说/漫画\n· 工作室 /studio 长期经营\n· 发现广场 Remix、短链分享\n· 作品评论与社群互动\n· 样品馆降低创作门槛", x="1.8cm", y="7.5cm", width="14.2cm", height="8cm", font="Calibri", size="18", color=W, fill="none"),
            shape(4, geometry="roundRect", fill=P, x="17.1cm", y="5.4cm", width="14.8cm", height="11cm", line="none"),
            shape(4, text="消费 · 像抖音", x="17.4cm", y="5.9cm", width="14.2cm", height="1.3cm", font="Calibri", size="22", bold="true", color=A, fill="none"),
            shape(4, text="· /arcade 竖滑全屏试玩 Feed\n· 小说/漫画竖滑阅读 Feed\n· 底栏 Dock 跨模态刷内容\n· 先惊艳结果，再深度打磨\n· 信息流里完成获客与留存", x="17.4cm", y="7.5cm", width="14.2cm", height="8cm", font="Calibri", size="18", color=W, fill="none"),
        ]
    )
    notes(4, "重点纠偏：Operone 战略价值是内容平台获客，不是卖创作工具。AI 降低供给成本，Feed 放大消费，社区完成裂变。")

    # ── 5 Operone flywheel ──
    print("5 flywheel")
    slide(W)
    batch(
        [
            title(5, "Operone 飞轮：创作者 → 流量 → 价值"),
            shape(5, geometry="roundRect", fill=L, name="F1", x="1.5cm", y="5.5cm", width="6.5cm", height="7.5cm", line="none"),
            shape(5, text="1\n创作", x="1.5cm", y="6cm", width="6.5cm", height="2.5cm", font="Georgia", size="28", bold="true", color=P, align="center", fill="none"),
            shape(5, text="一句话生成\n可玩可读可看\nUGC 近零边际成本", x="1.7cm", y="9cm", width="6.1cm", height="3.5cm", font="Calibri", size="16", color=T, align="center", fill="none"),
            shape(5, geometry="roundRect", fill=L, name="F2", x="9.5cm", y="5.5cm", width="6.5cm", height="7.5cm", line="none"),
            shape(5, text="2\n分发", x="9.5cm", y="6cm", width="6.5cm", height="2.5cm", font="Georgia", size="28", bold="true", color=P, align="center", fill="none"),
            shape(5, text="竖滑 Feed\n发现广场\n短链与 Remix", x="9.7cm", y="9cm", width="6.1cm", height="3.5cm", font="Calibri", size="16", color=T, align="center", fill="none"),
            shape(5, geometry="roundRect", fill=L, name="F3", x="17.5cm", y="5.5cm", width="6.5cm", height="7.5cm", line="none"),
            shape(5, text="3\n裂变", x="17.5cm", y="6cm", width="6.5cm", height="2.5cm", font="Georgia", size="28", bold="true", color=P, align="center", fill="none"),
            shape(5, text="社群评论\n创作者互相引流\n新用户变成创作者", x="17.7cm", y="9cm", width="6.1cm", height="3.5cm", font="Calibri", size="16", color=T, align="center", fill="none"),
            shape(5, geometry="roundRect", fill=D, name="F4", x="25.5cm", y="5.5cm", width="6.5cm", height="7.5cm", line="none"),
            shape(5, text="4\n变现", x="25.5cm", y="6cm", width="6.5cm", height="2.5cm", font="Georgia", size="28", bold="true", color=A, align="center", fill="none"),
            shape(5, text="流量换成价值\n额度 / 会员\n品牌与生态导流", x="25.7cm", y="9cm", width="6.1cm", height="3.5cm", font="Calibri", size="16", color=W, align="center", fill="none"),
            shape(5, text="AI 让第 1 步极便宜 → Feed 让第 2 步极高频 → 社区让第 3 步自发增长 → 第 4 步兑现商业价值", x="1.5cm", y="3.7cm", width="30.87cm", height="1.4cm", font="Calibri", size="18", color=M, fill="none"),
        ]
    )
    # connectors between flywheel cards
    for fr, to in (("F1", "F2"), ("F2", "F3"), ("F3", "F4")):
        run(
            "add",
            str(FILE),
            "/slide[5]",
            "--type",
            "connector",
            "--prop",
            "shape=straight",
            "--prop",
            f"from=/slide[5]/shape[@name={fr}]",
            "--prop",
            f"to=/slide[5]/shape[@name={to}]",
            "--prop",
            f"line={A}",
            "--prop",
            "lineWidth=2pt",
            "--prop",
            "tailEnd=triangle",
        )
    notes(5, "飞轮口播：装流量是中间目标，换成价值是终点。AI 创作是燃料，不是产品本身。")

    # ── 6 Operone product proof ──
    print("6 product proof")
    slide(W)
    batch(
        [
            title(6, "能力已落地：创作管线 × 内容消费双引擎"),
            shape(6, geometry="roundRect", fill=L, x="1.5cm", y="4cm", width="15.2cm", height="12.5cm", line="none"),
            shape(6, text="三大创作链路", x="1.9cm", y="4.5cm", width="14.4cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, fill="none"),
            shape(6, text="游戏  Phaser / Godot / Agentic 三层运行时\n小说  Bible→章纲→逐章写作→完整性修复\n漫画  轻量/导演双流水线 + 延迟配图\n\n共享账号、工作室、发现、五语系 i18n\n先给惊艳结果，再进第二层精炼", x="1.9cm", y="6.2cm", width="14.4cm", height="9.5cm", font="Calibri", size="18", color=T, fill="none"),
            shape(6, geometry="roundRect", fill=C2, x="17.5cm", y="4cm", width="14.4cm", height="12.5cm", line="none"),
            shape(6, text="内容分发与社区", x="17.9cm", y="4.5cm", width="13.6cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, fill="none"),
            shape(6, text="/arcade  TikTok 式竖滑试玩\n/novel/feed · /comic/feed  竖滑阅读\n/discover  发现广场 + Remix\n评论流 · 点赞试玩统计 · 短链 /s\nMobileBrowseDock 跨模态导航\n\n对标抖音/小红书的产品形态已具备", x="17.9cm", y="6.2cm", width="13.6cm", height="9.5cm", font="Calibri", size="18", color=T, fill="none"),
        ]
    )
    notes(6, "用 README 里的真实能力作证：街机 Feed、文学 Feed、发现、Remix、评论——这是内容平台骨架，不是演示页。")

    # ── 7 1ONE Work ──
    print("7 work")
    slide(W)
    batch(
        [
            title(7, "1ONE Work：对标腾讯 WorkBuddy 的职场入口"),
            shape(7, text="不是又一个聊天窗口——是能进团队交付、又守住隐私边界的 Cowork 平台", x="1.5cm", y="3.6cm", width="30.87cm", height="1.3cm", font="Calibri", size="18", color=M, fill="none"),
            shape(7, geometry="roundRect", fill=L, x="1.5cm", y="5.3cm", width="7.3cm", height="11cm", line="none"),
            shape(7, text="协作", x="1.5cm", y="5.9cm", width="7.3cm", height="1.5cm", font="Georgia", size="28", bold="true", color=P, align="center", fill="none"),
            shape(7, text="Team Mode 编队\nIssues 看板\n共享会话\n技能下发团队", x="1.7cm", y="8cm", width="6.9cm", height="7cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(7, geometry="roundRect", fill=L, x="9.5cm", y="5.3cm", width="7.3cm", height="11cm", line="none"),
            shape(7, text="高效", x="9.5cm", y="5.9cm", width="7.3cm", height="1.5cm", font="Georgia", size="28", bold="true", color=P, align="center", fill="none"),
            shape(7, text="多 Agent 并行\nCron 无人值守\n一句话出成品\n13+ 引擎自动发现", x="9.7cm", y="8cm", width="6.9cm", height="7cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(7, geometry="roundRect", fill=L, x="17.5cm", y="5.3cm", width="7.3cm", height="11cm", line="none"),
            shape(7, text="好用", x="17.5cm", y="5.9cm", width="7.3cm", height="1.5cm", font="Georgia", size="28", bold="true", color=P, align="center", fill="none"),
            shape(7, text="内置引擎零配置\n20+ 专业助手\nPPT / Excel / 论文\n装好就能用", x="17.7cm", y="8cm", width="6.9cm", height="7cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(7, geometry="roundRect", fill=D, x="25.5cm", y="5.3cm", width="7.3cm", height="11cm", line="none"),
            shape(7, text="隐私", x="25.5cm", y="5.9cm", width="7.3cm", height="1.5cm", font="Georgia", size="28", bold="true", color=A, align="center", fill="none"),
            shape(7, text="数据默认本机\nKey 不经中转\n可私有化部署\n企业边界可控", x="25.7cm", y="8cm", width="6.9cm", height="7cm", font="Calibri", size="18", color=W, align="center", fill="none"),
        ]
    )
    notes(7, "Work 与 Operone 分流：一个装 C 端内容流量，一个打职场交付与付费意愿。共同消耗底层 AI。")

    # ── 8 OneRoute ──
    print("8 oneroute")
    slide(W)
    batch(
        [
            title(8, "OneRoute：统一 AI API 网关，一路接入百模"),
            shape(8, text="战略角色：为 Operone 与 1ONE Work 提供可规模化的模型供给与计量", x="1.5cm", y="3.6cm", width="30.87cm", height="1.2cm", font="Calibri", size="18", color=M, fill="none"),
            shape(8, geometry="roundRect", fill=L, x="1.5cm", y="5.2cm", width="9.78cm", height="11cm", line="none"),
            shape(8, text="一个 Key", x="1.5cm", y="5.8cm", width="9.78cm", height="1.5cm", font="Georgia", size="26", bold="true", color=P, align="center", fill="none"),
            shape(8, text="兼容 OpenAI 协议\n多厂商一套账单\n4 步完成集成\n无需重构现有代码", x="1.8cm", y="8cm", width="9.2cm", height="7cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(8, geometry="roundRect", fill=L, x="12.04cm", y="5.2cm", width="9.78cm", height="11cm", line="none"),
            shape(8, text="为生产而建", x="12.04cm", y="5.8cm", width="9.78cm", height="1.5cm", font="Georgia", size="26", bold="true", color=P, align="center", fill="none"),
            shape(8, text="智能模型路由\n透明定价与用量\n排行与厂商份额\n成本优化可见", x="12.34cm", y="8cm", width="9.2cm", height="7cm", font="Calibri", size="18", color=T, align="center", fill="none"),
            shape(8, geometry="roundRect", fill=D, x="22.58cm", y="5.2cm", width="9.78cm", height="11cm", line="none"),
            shape(8, text="闭环价值", x="22.58cm", y="5.8cm", width="9.78cm", height="1.5cm", font="Georgia", size="26", bold="true", color=A, align="center", fill="none"),
            shape(8, text="前台越用越重\n底座议价越强\n毛利与稳定性\n反哺双业务", x="22.88cm", y="8cm", width="9.2cm", height="7cm", font="Calibri", size="18", color=W, align="center", fill="none"),
        ]
    )
    notes(8, "OneRoute 不是广告页故事，是聚合平台。投放站 ai.1oneclaw.com 导流正式站 ai.oneroute.vip。")

    # ── 9 OpenClaw ──
    print("9 openclaw")
    slide(W)
    batch(
        [
            title(9, "OpenClaw：Agent 跑起来之后的运维与可观测"),
            shape(9, text="解决「装完就跑」之后的黑盒：网关、Token、多 Agent、模型实验、配置写回", x="1.5cm", y="3.6cm", width="30.87cm", height="1.2cm", font="Calibri", size="18", color=M, fill="none"),
            shape(9, geometry="ellipse", fill=A, x="2cm", y="5.5cm", width="2.4cm", height="2.4cm", line="none"),
            shape(9, text="1", x="2cm", y="5.9cm", width="2.4cm", height="1.6cm", font="Georgia", size="28", bold="true", color=W, align="center", fill="none"),
            shape(9, text="本地真相 · 网关同源", x="5.2cm", y="5.5cm", width="26cm", height="1.1cm", font="Calibri", size="20", bold="true", color=P, fill="none"),
            shape(9, text="锚定本机目录与 Gateway，文件即真相，少手抄 JSON", x="5.2cm", y="6.7cm", width="26cm", height="1.1cm", font="Calibri", size="18", color=T, fill="none"),
            shape(9, geometry="ellipse", fill=A, x="2cm", y="9.2cm", width="2.4cm", height="2.4cm", line="none"),
            shape(9, text="2", x="2cm", y="9.6cm", width="2.4cm", height="1.6cm", font="Georgia", size="28", bold="true", color=W, align="center", fill="none"),
            shape(9, text="多 Agent 一屏掌控", x="5.2cm", y="9.2cm", width="26cm", height="1.1cm", font="Calibri", size="20", bold="true", color=P, fill="none"),
            shape(9, text="会话、状态、告警可扫一眼——直接服务 1ONE Work 的团队交付场景", x="5.2cm", y="10.4cm", width="26cm", height="1.1cm", font="Calibri", size="18", color=T, fill="none"),
            shape(9, geometry="ellipse", fill=A, x="2cm", y="12.9cm", width="2.4cm", height="2.4cm", line="none"),
            shape(9, text="3", x="2cm", y="13.3cm", width="2.4cm", height="1.6cm", font="Georgia", size="28", bold="true", color=W, align="center", fill="none"),
            shape(9, text="模型可实验、可落库", x="5.2cm", y="12.9cm", width="26cm", height="1.1cm", font="Calibri", size="20", bold="true", color=P, fill="none"),
            shape(9, text="与 OneRoute 聚合供给衔接：换模、试模、写回配置，形成执行层闭环", x="5.2cm", y="14.1cm", width="26cm", height="1.1cm", font="Calibri", size="18", color=T, fill="none"),
        ]
    )
    notes(9, "OpenClaw 是 Agent 基建与运维台，不是第四个独立 C 端产品。价值在支撑 Work 与本地 Agent 生态。")

    # ── 10 Closed loop ──
    print("10 loop")
    slide(W)
    batch(
        [
            title(10, "整套市场战略的 AI 闭环"),
            shape(10, geometry="roundRect", fill=D, name="L1", x="1.5cm", y="4.5cm", width="14.8cm", height="5.5cm", line="none"),
            shape(10, text="内容获客前台", x="1.9cm", y="4.9cm", width="14cm", height="1.2cm", font="Calibri", size="20", bold="true", color=A, fill="none"),
            shape(10, text="Operone\n创作者生产 → Feed 消费 → 社群裂变 → 装流量换价值", x="1.9cm", y="6.4cm", width="14cm", height="3cm", font="Calibri", size="18", color=W, fill="none"),
            shape(10, geometry="roundRect", fill=P, name="L2", x="17.5cm", y="4.5cm", width="14.8cm", height="5.5cm", line="none"),
            shape(10, text="职场交付前台", x="17.9cm", y="4.9cm", width="14cm", height="1.2cm", font="Calibri", size="20", bold="true", color=A, fill="none"),
            shape(10, text="1ONE Work\n多 Agent Cowork → Issues 交付 → 隐私本机 → 企业付费", x="17.9cm", y="6.4cm", width="14cm", height="3cm", font="Calibri", size="18", color=W, fill="none"),
            shape(10, geometry="roundRect", fill=L, name="L3", x="5cm", y="11.2cm", width="23.87cm", height="5.2cm", line="none"),
            shape(10, text="底层 AI 聚合与 Agent 基建", x="5.4cm", y="11.6cm", width="23cm", height="1.1cm", font="Calibri", size="20", bold="true", color=P, align="center", fill="none"),
            shape(10, text="OneRoute（模型路由·计量·生产网关）  +  OpenClaw（Agent 运维·可观测·配置落库）\n前台消耗 → 底座规模与议价 → 降本增稳 → 反哺前台增长", x="5.4cm", y="13cm", width="23cm", height="2.8cm", font="Calibri", size="18", color=T, align="center", fill="none"),
        ]
    )
    for fr, to in (("L1", "L3"), ("L2", "L3")):
        run(
            "add",
            str(FILE),
            "/slide[10]",
            "--type",
            "connector",
            "--prop",
            "shape=straight",
            "--prop",
            f"from=/slide[10]/shape[@name={fr}]",
            "--prop",
            f"to=/slide[10]/shape[@name={to}]",
            "--prop",
            f"line={A}",
            "--prop",
            "lineWidth=2pt",
            "--prop",
            "tailEnd=triangle",
        )
    notes(10, "收束页：听众应能复述「双前台 + 一层底座」。内容侧装流量，职场侧收价值密度，底座打通成本与能力。")

    # ── 11 Competitive ──
    print("11 compete")
    slide(W)
    batch([title(11, "竞争位：我们打的是「组合拳」，不是单点功能")])
    run(
        "add",
        str(FILE),
        "/slide[11]",
        "--type",
        "table",
        "--prop",
        "data=维度,内容社区,AI创作工具,办公Agent,1ONE闭环;对标,抖音/小红书,单一生成器,WorkBuddy,组合位;创作者供给,强,中,弱,强;信息流消费,强,弱,无,强;职场交付,弱,弱,强,强;模型聚合自控,弱,外采,外采,强;Agent运维,无,弱,中,强",
        "--prop",
        "style=medium1",
        "--prop",
        f"headerFill={P}",
        "--prop",
        "x=1.5cm",
        "--prop",
        "y=4.2cm",
        "--prop",
        "width=30.87cm",
        "--prop",
        "height=12.5cm",
    )
    notes(11, "强调组合位：单打内容或单打办公都能被巨头覆盖；同时占内容获客 + 职场交付 + 自有聚合，才是差异化。")

    # ── 12 Shipped ──
    print("12 shipped")
    slide(W)
    batch(
        [
            title(12, "已经铺开的入口与能力"),
            shape(12, geometry="roundRect", fill=L, x="1.5cm", y="4.2cm", width="14.8cm", height="12.2cm", line="none"),
            shape(12, text="战略业务已上线", x="1.9cm", y="4.8cm", width="14cm", height="1.2cm", font="Calibri", size="22", bold="true", color=P, fill="none"),
            shape(12, text="operone.1oneclaw.com\n创作 + 街机/文学 Feed + 社区\n\nwork.1oneclaw.com\n1ONE Work 获客与 COS 分发\n桌面客户端 1ONE Code", x="1.9cm", y="6.5cm", width="14cm", height="9cm", font="Calibri", size="18", color=T, fill="none"),
            shape(12, geometry="roundRect", fill=D, x="17.1cm", y="4.2cm", width="14.8cm", height="12.2cm", line="none"),
            shape(12, text="底座与基建已上线", x="17.5cm", y="4.8cm", width="14cm", height="1.2cm", font="Calibri", size="22", bold="true", color=A, fill="none"),
            shape(12, text="ai.1oneclaw.com → ai.oneroute.vip\nOneRoute 聚合投放与正式站\n\nclaw.1oneclaw.com\nOpenClaw 运维台叙事与入口\n同机 HTTPS 矩阵已就绪", x="17.5cm", y="6.5cm", width="14cm", height="9cm", font="Calibri", size="18", color=W, fill="none"),
        ]
    )
    notes(12, "证明不是 PPT 公司：四站已部署，产品能力可演示。路演可现场打开街机 Feed 与 Work 下载页。")

    # ── 13 Closing ──
    print("13 close")
    slide(D)
    batch(
        [
            shape(13, name="Band", geometry="rect", fill=A, x="0cm", y="18.5cm", width="33.87cm", height="0.55cm", line="none"),
            shape(13, text="一句话战略", x="2cm", y="4cm", width="29.87cm", height="1.2cm", font="Calibri", size="18", color=A, align="center", fill="none"),
            shape(13, text="用内容平台装流量，\n用职场 Cowork 收价值，\n用 AI 聚合打通闭环。", x="2cm", y="6cm", width="29.87cm", height="5.5cm", font="Georgia", size="32", bold="true", color=W, align="center", fill="none"),
            shape(13, text="Operone · 1ONE Work · OneRoute · OpenClaw", x="2cm", y="13cm", width="29.87cm", height="1.2cm", font="Calibri", size="18", color=S, align="center", fill="none"),
            shape(13, text="1ONE 生态  ·  2026", x="2cm", y="15cm", width="29.87cm", height="1cm", font="Calibri", size="16", color="7AB8B0", align="center", fill="none"),
        ]
    )
    notes(13, "结尾只留这一句。若听众追问，再展开飞轮或竞争表。")

    print("DONE", FILE)
    run("view", str(FILE), "text")


if __name__ == "__main__":
    main()
