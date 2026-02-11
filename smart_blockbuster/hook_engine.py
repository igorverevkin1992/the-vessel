"""
Движок хуков — Часть 3 мануала «Умный блокбастер».

Реализует:
- Трёхшаговую формулу синтеза (Context Lean-in + Anchor → Scroll Stop → Contrarian Snapback)
- Шесть архетипов хуков с адаптацией Харриса
- Чек-лист валидации (4 «Всадника Апокалипсиса»)
- Интерактивный конструктор хуков
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .models import (
    ContentType,
    CONTENT_TYPE_META,
    Hook,
    HookArchetype,
    HookError,
    HookStep,
    HOOK_ARCHETYPE_META,
    HOOK_ERROR_CHECKS,
)


# ---------------------------------------------------------------------------
# Валидация хука
# ---------------------------------------------------------------------------

@dataclass
class HookValidationResult:
    """Результат проверки хука по чек-листу «4 Всадника Апокалипсиса»."""

    error: HookError
    passed: bool
    detail: str


def validate_hook(hook: Hook) -> list[HookValidationResult]:
    """
    Проверяет хук на наличие четырёх критических ошибок.

    Проверки:
    1. Delay — Якорь присутствует в первом шаге?
    2. Confusion — Текст простой? Визуал соответствует?
    3. Irrelevance — Есть обращение к зрителю?
    4. Disinterest — Есть конфликт / высокие ставки?
    """
    results: list[HookValidationResult] = []

    # 1. DELAY: Якорь показан в кадре 0?
    anchor_step = hook.step1_anchor
    has_visual = bool(anchor_step.visual and anchor_step.visual.strip())
    results.append(HookValidationResult(
        error=HookError.DELAY,
        passed=has_visual,
        detail=(
            "Визуальный якорь указан в шаге 1."
            if has_visual
            else "ОШИБКА: Визуальный якорь отсутствует в шаге 1. Переписать!"
        ),
    ))

    # 2. CONFUSION: Простые слова? Визуал соответствует тексту?
    all_text = " ".join(s.text for s in hook.steps())
    long_words = [w for w in re.findall(r"[а-яёА-ЯЁa-zA-Z]+", all_text) if len(w) > 15]
    visuals_present = all(bool(s.visual.strip()) for s in hook.steps())
    confusion_ok = len(long_words) == 0 and visuals_present
    results.append(HookValidationResult(
        error=HookError.CONFUSION,
        passed=confusion_ok,
        detail=(
            "Текст простой, визуалы прописаны для каждого шага."
            if confusion_ok
            else (
                f"ВНИМАНИЕ: Сложные слова ({', '.join(long_words[:5])}) "
                f"или отсутствует визуал. Правило 6-го класса нарушено."
            )
        ),
    ))

    # 3. IRRELEVANCE: Обращение к зрителю (Audience of One)?
    audience_markers = ["вы", "вас", "вам", "ваш", "ваши", "тебя", "тебе",
                        "you", "your", "посмотрите", "представьте", "look"]
    text_lower = all_text.lower()
    has_audience = any(m in text_lower for m in audience_markers)
    results.append(HookValidationResult(
        error=HookError.IRRELEVANCE,
        passed=has_audience,
        detail=(
            "Обращение к зрителю обнаружено (Audience of One)."
            if has_audience
            else "ОШИБКА: Нет обращения к зрителю. Добавить «вы» / «посмотрите»."
        ),
    ))

    # 4. DISINTEREST: Есть конфликт / высокие ставки?
    conflict_markers = [
        "но", "однако", "проблема", "скрыва", "тайн", "опасн", "шок",
        "безумие", "невозможно", "запрещ", "секрет", "скандал", "угроз",
        "but", "however", "secret", "hidden", "shocking", "danger",
    ]
    snapback_text = hook.step3_snapback.text.lower()
    has_conflict = any(m in snapback_text or m in text_lower for m in conflict_markers)
    results.append(HookValidationResult(
        error=HookError.DISINTEREST,
        passed=has_conflict,
        detail=(
            "Конфликт / высокие ставки обнаружены."
            if has_conflict
            else "ВНИМАНИЕ: Ставки не выглядят достаточно высокими. Усилить конфликт."
        ),
    ))

    return results


def format_validation_report(results: list[HookValidationResult]) -> str:
    """Форматирует отчёт валидации хука."""
    lines = ["=" * 60, "  ЧЕК-ЛИСТ ВАЛИДАЦИИ ХУКА", "  (4 «Всадника Апокалипсиса»)", "=" * 60]

    passed_count = sum(1 for r in results if r.passed)

    for r in results:
        meta = HOOK_ERROR_CHECKS[r.error.value]
        status = "[OK]" if r.passed else "[!!]"
        lines.append(f"\n{status} {meta['name_ru']}")
        lines.append(f"    Вопрос: {meta['question']}")
        lines.append(f"    Результат: {r.detail}")

    lines.append(f"\nИтого: {passed_count}/4 проверок пройдено.")

    if passed_count == 4:
        lines.append("Хук готов к съёмке.")
    elif passed_count >= 2:
        lines.append("Хук требует доработки по отмеченным пунктам.")
    else:
        lines.append("Хук необходимо переписать.")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Конструктор хуков
# ---------------------------------------------------------------------------

def build_hook_interactive() -> Hook:
    """Интерактивный конструктор хука по трёхшаговой формуле."""

    print("\n" + "=" * 60)
    print("  КОНСТРУКТОР ХУКА «УМНОГО БЛОКБАСТЕРА»")
    print("  (Трёхшаговая формула синтеза Кэллоуэя + Харриса)")
    print("=" * 60)

    # Выбор архетипа
    print("\nШесть архетипов хуков:")
    archetypes = list(HookArchetype)
    for i, arch in enumerate(archetypes, 1):
        meta = HOOK_ARCHETYPE_META[arch.value]
        print(f"  {i}. {meta['name_ru']}")
        print(f"     Триггер: {meta['trigger']}")
        print(f"     Адаптация: {meta['adaptation'][:80]}...")

    while True:
        try:
            choice = int(input("\nВыберите архетип (1-6): "))
            if 1 <= choice <= 6:
                break
        except ValueError:
            pass
        print("Введите число от 1 до 6.")

    archetype = archetypes[choice - 1]
    meta = HOOK_ARCHETYPE_META[archetype.value]
    print(f"\nВыбран: {meta['name_ru']}")

    # Шаг 1: Контекстное вовлечение + Якорь
    print("\n--- Шаг 1: Контекстное вовлечение через Якорь ---")
    print("Цель: Мгновенная ясность темы + Сенсорное доказательство.")
    print("Правило: Начинать с демонстрации конкретного артефакта.")
    print("Пример: «Посмотрите на этот рукописный меморандум ЦРУ...»")
    text1 = input("Текст шага 1: ")
    visual1 = input("Визуал шага 1 (что в кадре?): ")
    step1 = HookStep(
        name="Контекстное вовлечение + Якорь",
        goal="Мгновенная ясность темы + Сенсорное доказательство",
        text=text1,
        visual=visual1,
    )

    # Шаг 2: Интервенция остановки
    print("\n--- Шаг 2: Интервенция остановки (Scroll Stop) ---")
    print("Цель: Паттерн-интеррапт. Сбить инерцию мышления.")
    print("Формулы: «Но подождите...», «Однако...», «И вот где начинается безумие...»")
    text2 = input("Текст шага 2: ")
    visual2 = input("Визуал шага 2 (резкий зум / смена цвета / SFX): ")
    step2 = HookStep(
        name="Интервенция остановки",
        goal="Паттерн-интеррапт: сбить инерцию мышления",
        text=text2,
        visual=visual2,
    )

    # Шаг 3: Контрарный отскок
    print("\n--- Шаг 3: Контрарный отскок (Contrarian Snapback) ---")
    print("Цель: Создание разрыва (Curiosity Gap).")
    print("Пример: «...Потому что этот документ не о нефти.")
    print("         Он о том, как одна компания купила целую страну за 0 долларов».")
    text3 = input("Текст шага 3: ")
    visual3 = input("Визуал шага 3: ")
    step3 = HookStep(
        name="Контрарный отскок",
        goal="Создание разрыва (Curiosity Gap)",
        text=text3,
        visual=visual3,
    )

    return Hook(
        archetype=archetype,
        step1_anchor=step1,
        step2_interjection=step2,
        step3_snapback=step3,
    )


def suggest_hook_for_content_type(content_type: ContentType) -> str:
    """Возвращает рекомендации по хуку для данного типа контента."""
    meta = CONTENT_TYPE_META[content_type.value]
    lines = [
        f"Тип контента: {meta['name_ru']}",
        f"Рекомендуемый подход к хуку: {meta['hook_approach']}",
        f"Тип визуального якоря: {meta['visual_anchor']}",
        f"Пример темы: {meta['example']}",
    ]
    return "\n".join(lines)


def format_hook(hook: Hook) -> str:
    """Форматирует хук для вывода."""
    meta = HOOK_ARCHETYPE_META[hook.archetype.value]
    lines = [
        "=" * 60,
        f"  ХУК — Архетип: {meta['name_ru']}",
        f"  Триггер: {meta['trigger']}",
        "=" * 60,
    ]
    for i, step in enumerate(hook.steps(), 1):
        lines.append(f"\n  Шаг {i}: {step.name}")
        lines.append(f"  Цель: {step.goal}")
        lines.append(f"  Текст: «{step.text}»")
        if step.visual:
            lines.append(f"  Визуал: [{step.visual}]")
    return "\n".join(lines)
