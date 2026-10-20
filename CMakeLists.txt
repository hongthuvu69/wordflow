cmake_minimum_required(VERSION 3.21)

project(WordFlow VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Quick QuickControls2 Sql Network)

qt_standard_project_setup(REQUIRES 6.8)

qt_add_executable(WordFlow src/main.cpp)

set_source_files_properties(qml/Theme.qml qml/AppNav.qml
    PROPERTIES QT_QML_SINGLETON_TYPE TRUE)

qt_add_qml_module(WordFlow
    URI WordFlow
    VERSION 1.0
    SOURCES
        src/contentstore.h src/contentstore.cpp
        src/progressstore.h src/progressstore.cpp
        src/speech.h src/speech.cpp
        src/syncclient.h src/syncclient.cpp
    QML_FILES
        qml/Main.qml
        qml/Theme.qml
        qml/AppNav.qml
        qml/Card.qml
        qml/Chip.qml
        qml/SpeakButton.qml
        qml/StatCard.qml
        qml/PageHeader.qml
        qml/WordCardContent.qml
        qml/HomePage.qml
        qml/TopicsPage.qml
        qml/TopicDetailPage.qml
        qml/WordDetailPage.qml
        qml/StudyPage.qml
        qml/QuizPage.qml
        qml/PhrasesPage.qml
        qml/SettingsPage.qml
        qml/PracticePage.qml
        qml/practice.js
)

# Nội dung học (JSON) được nhúng vào app tại :/content/
file(GLOB CONTENT_FILES RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} CONFIGURE_DEPENDS content/*.json)
qt_add_resources(WordFlow "content"
    PREFIX "/"
    FILES ${CONTENT_FILES}
)

set_target_properties(WordFlow PROPERTIES
    WIN32_EXECUTABLE TRUE
    MACOSX_BUNDLE TRUE
)

target_include_directories(WordFlow PRIVATE src)
target_link_libraries(WordFlow PRIVATE Qt6::Quick Qt6::QuickControls2 Qt6::Sql Qt6::Network)

if(WIN32)
    target_link_libraries(WordFlow PRIVATE ole32 sapi)
endif()

include(GNUInstallDirs)
install(TARGETS WordFlow
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
