"""
Производственный протокол — Часть 8 мануала «Умный блокбастер».

Реализует:
- Генерацию двухколоночного A/V сценария
- 5-этапный производственный протокол
- Чек-листы для каждого этапа
- Экспорт сценария в текстовый формат
"""

from __future__ import annotations

import json
from pathlib import Path

from .models import (
    AVLine,
    AVScript,
    EvidenceLoop,
    Hook,
    ScriptBlock,
    SerratedPhase,
    SERRATED_PHASE_META,
    VisualType,
)


# ---------------------------------------------------------------------------
# Производственные этапы (Часть 8)
# ---------------------------------------------------------------------------

PRODUCTION_STAGES = [
    {
        "stage": 1,
        "name": "Рисерч и Инвентаризация (Fact Inventory)",
        "tasks": [
            "Сбор фактуры: поиск первичных источников (отчёты, карты, документы).",
            "Поиск «Шокирующего артефакта» для Хука.",
            "Определение Злодея (Системы) и Жертвы (Зрителя).",
        ],
        "checklist": [
            "Есть ли минимум 3 первичных источника (не вторичные статьи)?",
            "Найден ли визуально яркий артефакт для Хука?",
            "Определён ли Злодей (система/компания) и Жертва (зритель)?",
        ],
    },
    {
        "stage": 2,
        "name": "Скелет Сюжета (Looping)",
        "tasks": [
            "Определить Главное Обещание видео (The Promise).",
            "Разбить сюжет на 2-минутные блоки (Зубчатая дуга).",
            "Написать сценарий с использованием метода «But / Therefore».",
        ],
        "checklist": [
            "Обещание сформулировано в 1 предложении?",
            "Каждый 2-мин блок заканчивается Перезацепом?",
            "Все связки «И затем» заменены на «Но» / «Следовательно»?",
        ],
    },
    {
        "stage": 3,
        "name": "Скриптинг и Визуальное ТЗ",
        "tasks": [
            "Написать текст в стиле «Стаккато» (короткие предложения).",
            "Вставить дейктические драйверы («Посмотрите сюда»).",
            "Создать двухколоночный A/V сценарий.",
        ],
        "checklist": [
            "Среднее кол-во слов в предложении <= 8?",
            "Есть ли дейктические драйверы (минимум 1 на петлю)?",
            "Напротив каждой строки текста прописан визуал?",
            "Используются ли коннекторы Харриса (по сути, честно говоря)?",
        ],
    },
    {
        "stage": 4,
        "name": "Съёмка (Talking Head)",
        "tasks": [
            "Свет: кинематографичный, с акцентом на лице.",
            "Подача: энергичная (+50% эмоций), с паузами для монтажа.",
            "Перформативная уязвимость: признание сомнений.",
        ],
        "checklist": [
            "Свет настроен кинематографично (3-точечная схема)?",
            "Подача энергичная, с жестикуляцией?",
            "Есть моменты перформативной уязвимости?",
            "Паузы между фразами для удобной нарезки?",
        ],
    },
    {
        "stage": 5,
        "name": "Пост-продакшн (The Retention Edit)",
        "tasks": [
            "A-Cut: сборка голоса без пауз (Silence Removal).",
            "Visual Matching: наложение карт, документов и B-Roll.",
            "Pattern Interrupts: визуальные изменения каждые 5 секунд.",
            "Sound Pass: наложение музыки и SFX.",
            "Hook Polish: первые 30 секунд отполированы до идеала.",
        ],
        "checklist": [
            "Удалены все паузы, вдохи, эканья (Value Compression)?",
            "Визуал совпадает с аудио (Visual Matching)?",
            "Pattern Interrupt каждые 5 секунд (зум, текст, B-Roll)?",
            "SFX на каждое визуальное действие (whoosh, paper rustle)?",
            "Музыка меняется с фазами (тайна → расследование → откровение)?",
            "Первые 30 секунд идеальны (каждый кадр, каждый звук)?",
        ],
    },
]


def format_production_protocol() -> str:
    """Выводит полный производственный протокол."""
    lines = [
        "=" * 70,
        "  ПРОИЗВОДСТВЕННЫЙ ПРОТОКОЛ «УМНОГО БЛОКБАСТЕРА»",
        "  (Часть 8: Пошаговый алгоритм внедрения)",
        "=" * 70,
    ]

    for stage in PRODUCTION_STAGES:
        lines.append(f"\n{'─' * 70}")
        lines.append(f"  ЭТАП {stage['stage']}: {stage['name']}")
        lines.append(f"{'─' * 70}")

        lines.append("\n  Задачи:")
        for i, task in enumerate(stage["tasks"], 1):
            lines.append(f"    {i}. {task}")

        lines.append("\n  Чек-лист:")
        for item in stage["checklist"]:
            lines.append(f"    [ ] {item}")

    return "\n".join(lines)


def format_production_stage(stage_num: int) -> str:
    """Выводит один этап производственного протокола."""
    if stage_num < 1 or stage_num > len(PRODUCTION_STAGES):
        return f"Этап {stage_num} не существует. Доступны этапы 1-{len(PRODUCTION_STAGES)}."

    stage = PRODUCTION_STAGES[stage_num - 1]
    lines = [
        f"{'─' * 70}",
        f"  ЭТАП {stage['stage']}: {stage['name']}",
        f"{'─' * 70}",
        "\n  Задачи:",
    ]
    for i, task in enumerate(stage["tasks"], 1):
        lines.append(f"    {i}. {task}")

    lines.append("\n  Чек-лист:")
    for item in stage["checklist"]:
        lines.append(f"    [ ] {item}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Генерация и экспорт A/V сценария
# ---------------------------------------------------------------------------

def build_av_line_interactive() -> AVLine:
    """Интерактивное создание одной строки A/V сценария."""
    timecode = input("  Таймкод (MM:SS): ")
    audio = input("  Аудио (текст автора): ")

    print("  Типы визуала:")
    types = list(VisualType)
    for i, vt in enumerate(types, 1):
        print(f"    {i}. {vt.value}")
    while True:
        try:
            vt_choice = int(input("  Тип визуала (номер): "))
            if 1 <= vt_choice <= len(types):
                break
        except ValueError:
            pass

    visual_type = types[vt_choice - 1]
    visual_desc = input("  Описание визуала: ")
    sfx = input("  SFX (звуковой эффект, Enter если нет): ")
    music = input("  Музыка/настроение (Enter если нет): ")

    return AVLine(
        timecode=timecode,
        audio_text=audio,
        visual_description=visual_desc,
        visual_type=visual_type,
        sfx=sfx,
        music_mood=music,
    )


def format_av_script(script: AVScript) -> str:
    """Форматирует A/V сценарий в двухколоночный формат."""
    lines = [
        "=" * 90,
        f"  A/V СЦЕНАРИЙ: «{script.title}»",
        f"  Обещание: {script.promise}",
        "=" * 90,
        "",
        f"  {'ТАЙМКОД':<10} {'АУДИО (текст автора)':<40} {'ВИЗУАЛ':<30} {'SFX / Музыка'}",
        f"  {'─' * 10} {'─' * 40} {'─' * 30} {'─' * 20}",
    ]

    for line in script.av_lines:
        audio_preview = (line.audio_text[:37] + "...") if len(line.audio_text) > 40 else line.audio_text
        visual_preview = (line.visual_description[:27] + "...") if len(line.visual_description) > 30 else line.visual_description
        sfx_music = line.sfx or line.music_mood or "—"

        lines.append(
            f"  {line.timecode:<10} {audio_preview:<40} [{visual_preview}] {sfx_music}"
        )

    lines.append(f"\n  Всего строк: {len(script.av_lines)}")
    return "\n".join(lines)


def export_script_json(script: AVScript, filepath: str) -> None:
    """Экспортирует A/V сценарий в JSON."""
    data = {
        "title": script.title,
        "promise": script.promise,
        "total_duration_sec": script.total_duration_sec,
        "hook": {
            "archetype": script.hook.archetype.value,
            "steps": [
                {
                    "name": step.name,
                    "goal": step.goal,
                    "text": step.text,
                    "visual": step.visual,
                }
                for step in script.hook.steps()
            ],
        } if script.hook else None,
        "blocks": [
            {
                "phase": block.phase.value,
                "timecode_start": block.timecode_start,
                "timecode_end": block.timecode_end,
                "intensity_pct": block.intensity_pct,
                "rehook_text": block.rehook_text,
                "evidence_loops": [
                    {
                        "context": loop.context,
                        "deictic_driver": loop.deictic_driver,
                        "evidence": loop.evidence,
                        "reveal": loop.reveal,
                        "transition": loop.transition,
                    }
                    for loop in block.evidence_loops
                ],
            }
            for block in script.blocks
        ],
        "av_lines": [
            {
                "timecode": line.timecode,
                "audio_text": line.audio_text,
                "visual_description": line.visual_description,
                "visual_type": line.visual_type.value,
                "sfx": line.sfx,
                "music_mood": line.music_mood,
            }
            for line in script.av_lines
        ],
    }

    path = Path(filepath)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def import_script_json(filepath: str) -> AVScript:
    """Импортирует A/V сценарий из JSON."""
    from .models import Hook, HookArchetype, HookStep

    path = Path(filepath)
    data = json.loads(path.read_text(encoding="utf-8"))

    hook = None
    if data.get("hook"):
        h = data["hook"]
        steps_data = h["steps"]
        hook = Hook(
            archetype=HookArchetype(h["archetype"]),
            step1_anchor=HookStep(**steps_data[0]),
            step2_interjection=HookStep(**steps_data[1]),
            step3_snapback=HookStep(**steps_data[2]),
        )

    blocks = []
    for bd in data.get("blocks", []):
        loops = [EvidenceLoop(**ld) for ld in bd.get("evidence_loops", [])]
        blocks.append(ScriptBlock(
            phase=SerratedPhase(bd["phase"]),
            timecode_start=bd["timecode_start"],
            timecode_end=bd["timecode_end"],
            intensity_pct=bd.get("intensity_pct", 50),
            rehook_text=bd.get("rehook_text", ""),
            evidence_loops=loops,
        ))

    av_lines = [
        AVLine(
            timecode=ld["timecode"],
            audio_text=ld["audio_text"],
            visual_description=ld["visual_description"],
            visual_type=VisualType(ld["visual_type"]),
            sfx=ld.get("sfx", ""),
            music_mood=ld.get("music_mood", ""),
        )
        for ld in data.get("av_lines", [])
    ]

    return AVScript(
        title=data["title"],
        promise=data.get("promise", ""),
        hook=hook,
        blocks=blocks,
        av_lines=av_lines,
        total_duration_sec=data.get("total_duration_sec", 0),
    )
