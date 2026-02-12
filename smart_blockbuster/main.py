#!/usr/bin/env python3
"""
Smart Blockbuster — CLI-инструмент для создания высокоудерживающего контента.

Синтез методологий Кэллоуэя (алгоритмическое удержание)
и Харриса (визуальная журналистика).

Использование:
    python -m smart_blockbuster                  # Интерактивное меню
    python -m smart_blockbuster --demo           # Демонстрация с примером
    python -m smart_blockbuster --analyze FILE   # Анализ JSON-сценария
    python -m smart_blockbuster --protocol       # Производственный протокол
"""

from __future__ import annotations

import argparse
import sys

from .models import (
    AVLine,
    AVScript,
    ContentType,
    CONTENT_TYPE_META,
    DopamineLevel,
    EvidenceLoop,
    Hook,
    HookArchetype,
    HookStep,
    HOOK_ARCHETYPE_META,
    SERRATED_PHASE_META,
    SerratedPhase,
    VisualType,
)
from .hook_engine import (
    build_hook_interactive,
    format_hook,
    format_validation_report,
    suggest_hook_for_content_type,
    validate_hook,
)
from .structure import (
    analyze_but_therefore,
    build_evidence_loop_interactive,
    format_but_therefore_report,
    format_evidence_loop,
    format_serrated_edge,
    generate_serrated_edge,
)
from .analyzer import (
    analyze_connectors,
    analyze_staccato,
    format_connectors_report,
    format_staccato_report,
    full_script_analysis,
)
from .production import (
    export_script_json,
    format_av_script,
    format_production_protocol,
    format_production_stage,
    import_script_json,
)
from .orchestrator import run_pipeline, show_pipeline_info


BANNER = r"""
 ____  __  __    _    ____ _____   ____  _     ___   ____ _  ______  _   _ ____ _____ _____ ____
/ ___||  \/  |  / \  |  _ \_   _| | __ )| |   / _ \ / ___| |/ / __ )| | | / ___|_   _| ____|  _ \
\___ \| |\/| | / _ \ | |_) || |   |  _ \| |  | | | | |   | ' /|  _ \| | | \___ \ | | |  _| | |_) |
 ___) | |  | |/ ___ \|  _ < | |   | |_) | |__| |_| | |___| . \| |_) | |_| |___) || | | |___|  _ <
|____/|_|  |_/_/   \_\_| \_\|_|   |____/|_____\___/ \____|_|\_\____/ \___/|____/ |_| |_____|_| \_\

  Архитектура «Умного блокбастера»
  Синтез методологий Кэллоуэя + Харриса
"""


def main_menu():
    """Главное интерактивное меню."""
    print(BANNER)

    while True:
        print("\n" + "=" * 60)
        print("  ГЛАВНОЕ МЕНЮ")
        print("=" * 60)
        print("""
  1. Конструктор Хука (3-шаговая формула)
  2. Генератор Зубчатой дуги (макро-структура)
  3. Конструктор Петли Доказательства
  4. Анализ текста (Стаккато + Коннекторы + But/Therefore)
  5. Типология контента (рекомендации)
  6. Дофаминовая лестница (теория)
  7. Производственный протокол (5 этапов)
  8. Анализ JSON-сценария
  9. Демонстрация (пример «Умного блокбастера»)

  A. КОНВЕЙЕР АГЕНТОВ (Scout → Radar → Analyst → Architect → Writer)
  I. Информация о конвейере агентов

  0. Выход
""")

        choice = input("  Выберите пункт: ").strip()

        if choice == "1":
            _menu_hook_constructor()
        elif choice == "2":
            _menu_serrated_edge()
        elif choice == "3":
            _menu_evidence_loop()
        elif choice == "4":
            _menu_text_analysis()
        elif choice == "5":
            _menu_content_typology()
        elif choice == "6":
            _menu_dopamine_ladder()
        elif choice == "7":
            _menu_production_protocol()
        elif choice == "8":
            _menu_analyze_json()
        elif choice == "9":
            _menu_demo()
        elif choice.lower() == "a":
            _menu_agent_pipeline()
        elif choice.lower() == "i":
            show_pipeline_info()
        elif choice == "0":
            print("\nДо встречи! Создавайте «Умные блокбастеры».")
            break
        else:
            print("Неверный выбор.")


# ---------------------------------------------------------------------------
# Пункты меню
# ---------------------------------------------------------------------------

def _menu_hook_constructor():
    """Пункт 1: Конструктор Хука."""
    hook = build_hook_interactive()
    print("\n" + format_hook(hook))
    print("\n" + format_validation_report(validate_hook(hook)))


def _menu_serrated_edge():
    """Пункт 2: Генератор Зубчатой дуги."""
    print("\n  Генератор Зубчатой дуги (The Serrated Edge)")
    while True:
        try:
            duration = int(input("  Длительность видео (минуты): "))
            if duration >= 5:
                break
            print("  Минимум 5 минут для «Умного блокбастера».")
        except ValueError:
            print("  Введите число.")

    blocks = generate_serrated_edge(duration)
    print("\n" + format_serrated_edge(blocks))


def _menu_evidence_loop():
    """Пункт 3: Конструктор Петли Доказательства."""
    loops: list[EvidenceLoop] = []
    while True:
        loop = build_evidence_loop_interactive()
        loops.append(loop)
        print(format_evidence_loop(loop, len(loops)))

        more = input("\n  Добавить ещё петлю? (д/н): ").strip().lower()
        if more not in ("д", "y", "да", "yes"):
            break

    print(f"\n  Создано петель доказательств: {len(loops)}")


def _menu_text_analysis():
    """Пункт 4: Анализ текста."""
    print("\n  Вставьте текст сценария (Enter дважды для завершения):")
    lines = []
    while True:
        line = input()
        if line == "":
            if lines and lines[-1] == "":
                break
            lines.append(line)
        else:
            lines.append(line)

    text = "\n".join(lines).strip()
    if not text:
        print("  Текст пуст.")
        return

    # Стаккато
    staccato = analyze_staccato(text)
    print("\n" + format_staccato_report(staccato))

    # Коннекторы Харриса
    connectors = analyze_connectors(text)
    print("\n" + format_connectors_report(connectors))

    # But/Therefore
    bt = analyze_but_therefore(text)
    print("\n" + format_but_therefore_report(bt))


def _menu_content_typology():
    """Пункт 5: Типология контента."""
    print("\n" + "=" * 60)
    print("  ТИПОЛОГИЯ КОНТЕНТА «УМНОГО БЛОКБАСТЕРА»")
    print("  (Таблица 2 из мануала)")
    print("=" * 60)

    for ct in ContentType:
        meta = CONTENT_TYPE_META[ct.value]
        print(f"\n  {meta['name_ru'].upper()}")
        print(f"  Подход к хуку:       {meta['hook_approach']}")
        print(f"  Визуальный якорь:    {meta['visual_anchor']}")
        print(f"  Пример:             {meta['example']}")


def _menu_dopamine_ladder():
    """Пункт 6: Дофаминовая лестница."""
    print("\n" + "=" * 60)
    print("  ДОФАМИНОВАЯ ЛЕСТНИЦА (The Dopamine Ladder)")
    print("  (Часть 2: Нейробиология зрителя)")
    print("=" * 60)

    for level in DopamineLevel:
        print(f"\n  Уровень {level.value}: {level.description_ru}")


def _menu_production_protocol():
    """Пункт 7: Производственный протокол."""
    print("\n" + format_production_protocol())

    stage = input("\n  Подробнее об этапе (1-5, Enter для пропуска): ").strip()
    if stage.isdigit():
        print("\n" + format_production_stage(int(stage)))


def _menu_analyze_json():
    """Пункт 8: Анализ JSON-сценария."""
    filepath = input("\n  Путь к JSON-файлу сценария: ").strip()
    if not filepath:
        print("  Путь не указан.")
        return

    try:
        script = import_script_json(filepath)
        print(full_script_analysis(script))
    except FileNotFoundError:
        print(f"  Файл не найден: {filepath}")
    except Exception as e:
        print(f"  Ошибка чтения: {e}")


def _menu_agent_pipeline():
    """Пункт A: Конвейер агентов."""
    print("\n  Режим конвейера:")
    print("    1. Автоматический (без пауз)")
    print("    2. Пошаговый (ревью между агентами)")

    mode = input("  Выбор (1/2): ").strip()
    steppable = mode == "2"
    run_pipeline(steppable=steppable)


def _menu_demo():
    """Пункт 9: Демонстрация с готовым примером."""
    print("\n" + "=" * 70)
    print("  ДЕМОНСТРАЦИЯ: Пример «Умного блокбастера»")
    print("  Тема: «Почему Starbucks на самом деле банк, а не кофейня»")
    print("=" * 70)

    # Создаём демо-хук
    hook = Hook(
        archetype=HookArchetype.CONTRARIAN,
        step1_anchor=HookStep(
            name="Контекстное вовлечение + Якорь",
            goal="Мгновенная ясность темы + Сенсорное доказательство",
            text="Посмотрите на этот финансовый отчёт Starbucks за 2024 год.",
            visual="Скан отчёта SEC, зум на строку 'Stored Value Card Liabilities: $1.77B'",
        ),
        step2_interjection=HookStep(
            name="Интервенция остановки",
            goal="Паттерн-интеррапт",
            text="Но подождите. Это не строка про кофе.",
            visual="Резкий зум, смена цветокоррекции на красный, звук скретча",
        ),
        step3_snapback=HookStep(
            name="Контрарный отскок",
            goal="Создание разрыва (Curiosity Gap)",
            text=(
                "Эта цифра означает, что вы дали Starbucks почти 2 миллиарда "
                "долларов в долг. Без процентов. Добровольно. "
                "И вот почему это проблема."
            ),
            visual="Инфографика: деньги перетекают от людей в хранилище Starbucks",
        ),
    )

    # Выводим хук
    print(format_hook(hook))

    # Валидируем
    results = validate_hook(hook)
    print("\n" + format_validation_report(results))

    # Зубчатая дуга для 12-минутного видео
    blocks = generate_serrated_edge(12)
    print("\n" + format_serrated_edge(blocks))

    # Петля доказательства
    loop = EvidenceLoop(
        context="Starbucks хранит на подарочных картах больше денег, чем многие банки.",
        deictic_driver="Посмотрите на эту диаграмму.",
        evidence="Сравнительная диаграмма: депозиты Starbucks vs региональные банки США",
        reveal=(
            "Starbucks Card — это по сути банковский депозит. "
            "Но без страховки FDIC и без обязательств по возврату."
        ),
        transition=(
            "НО если это банк, то где регулятор? "
            "СЛЕДОВАТЕЛЬНО нужно разобраться, кто контролирует эти деньги."
        ),
    )

    print("\n" + "-" * 60)
    print("  ПРИМЕР ПЕТЛИ ДОКАЗАТЕЛЬСТВА")
    print("-" * 60)
    print(format_evidence_loop(loop, 1))

    # Анализ демо-текста
    demo_text = (
        "Starbucks — это не кофейня. Это банк. Честно говоря, я был в шоке. "
        "Посмотрите на эту цифру. Полтора миллиарда долларов. "
        "Это больше, чем депозиты многих банков. Но подождите. "
        "Банки обязаны вернуть ваши деньги. А Starbucks — нет. "
        "По сути, вы дали им беспроцентный кредит. "
        "На самом деле, это гениальная схема. "
        "Но она создаёт проблему. "
        "Следовательно, регуляторы начинают задавать вопросы."
    )

    staccato = analyze_staccato(demo_text)
    print("\n" + format_staccato_report(staccato))

    connectors = analyze_connectors(demo_text)
    print("\n" + format_connectors_report(connectors))

    bt = analyze_but_therefore(demo_text)
    print("\n" + format_but_therefore_report(bt))

    # Демо A/V строки
    demo_av = [
        AVLine("00:00", "Посмотрите на этот отчёт Starbucks.",
               "Скан SEC-отчёта, зум на цифру", VisualType.DOCUMENT,
               "paper rustle", "ambient тревожный"),
        AVLine("00:03", "Но подождите. Это не про кофе.",
               "Snap Zoom на лицо, красный фильтр", VisualType.SNAP_ZOOM,
               "scratch sound", ""),
        AVLine("00:05", "Вы дали им 2 миллиарда в долг.",
               "Инфографика: деньги текут", VisualType.TEXT_OVERLAY,
               "whoosh", "driving beat"),
        AVLine("00:10", "И вот почему это проблема.",
               "B-Roll: люди в очереди Starbucks", VisualType.BROLL,
               "", "driving beat"),
        AVLine("00:15", "По сути, Starbucks — это банк.",
               "Сравнительная карта депозитов", VisualType.MAP,
               "paper rustle", "ambient нарастающий"),
        AVLine("00:22", "На самом деле, схема гениальна.",
               "Схема движения денег, анимация", VisualType.STOCK_FOOTAGE,
               "typewriter click", "epic пиано"),
    ]

    demo_script = AVScript(
        title="Почему Starbucks на самом деле банк",
        promise="Раскрыть скрытую финансовую модель Starbucks",
        hook=hook,
        av_lines=demo_av,
        total_duration_sec=720,
    )

    print("\n" + format_av_script(demo_script))

    # Полный анализ
    print("\n" + full_script_analysis(demo_script))

    # Экспорт
    export_path = "demo_script.json"
    try:
        export_script_json(demo_script, export_path)
        print(f"\n  Демо-сценарий сохранён в {export_path}")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cli():
    """Точка входа CLI."""
    parser = argparse.ArgumentParser(
        description="Smart Blockbuster — инструмент для высокоудерживающего контента",
    )
    parser.add_argument("--demo", action="store_true", help="Запустить демонстрацию")
    parser.add_argument("--analyze", type=str, help="Анализ JSON-сценария")
    parser.add_argument("--protocol", action="store_true", help="Производственный протокол")
    parser.add_argument("--text", type=str, help="Анализ текстового файла")
    parser.add_argument("--pipeline", action="store_true",
                        help="Запустить конвейер агентов (Scout → Writer)")
    parser.add_argument("--steppable", action="store_true",
                        help="Пошаговый режим конвейера (с --pipeline)")
    parser.add_argument("--agents-info", action="store_true",
                        help="Информация о конвейере агентов")

    args = parser.parse_args()

    if args.pipeline:
        run_pipeline(steppable=args.steppable)
    elif args.agents_info:
        show_pipeline_info()
    elif args.demo:
        _menu_demo()
    elif args.analyze:
        try:
            script = import_script_json(args.analyze)
            print(full_script_analysis(script))
        except FileNotFoundError:
            print(f"Файл не найден: {args.analyze}")
            sys.exit(1)
    elif args.protocol:
        print(format_production_protocol())
    elif args.text:
        try:
            with open(args.text, "r", encoding="utf-8") as f:
                text = f.read()
            staccato = analyze_staccato(text)
            print(format_staccato_report(staccato))
            connectors = analyze_connectors(text)
            print("\n" + format_connectors_report(connectors))
            bt = analyze_but_therefore(text)
            print("\n" + format_but_therefore_report(bt))
        except FileNotFoundError:
            print(f"Файл не найден: {args.text}")
            sys.exit(1)
    else:
        main_menu()


if __name__ == "__main__":
    cli()
